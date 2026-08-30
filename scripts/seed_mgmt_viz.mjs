import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadEnv(filePath) {
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

const root = process.cwd();
loadEnv(path.join(root, ".env.local"));
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const DATA_DIR = path.join(root, "data", "mgmt-viz");

const SUBJECT_META = {
  "경영정보 일반": { code: "general", sort: 1 },
  "데이터 해석 및 활용": { code: "data", sort: 2 },
  "경영정보시각화 디자인": { code: "design", sort: 3 },
};

async function main() {
  const { data: cert, error: certErr } = await admin
    .from("certifications")
    .upsert({ code: "mgmt-viz", name: "경영정보시각화능력", description: "대한상공회의소 경영정보시각화능력 필기 모의문제 기반 문제풀이", is_active: true, sort_order: 1 }, { onConflict: "code" })
    .select("id")
    .single();
  if (certErr) throw new Error("certification upsert failed: " + certErr.message);
  console.log("certification id:", cert.id);

  for (const form of ["A", "B"]) {
    const slug = `mgmt-viz-${form.toLowerCase()}`;
    const title = `경영정보시각화능력 모의문제 ${form}형`;

    const existing = await admin.from("exams").select("id").eq("slug", slug).maybeSingle();
    if (existing.data) { console.log(`skip ${slug}: already exists (id=${existing.data.id})`); continue; }

    const questions = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `form-${form.toLowerCase()}.json`), "utf8"));

    const { data: exam, error: examErr } = await admin
      .from("exams")
      .insert({
        slug, title,
        description: "대한상공회의소 경영정보시각화능력 필기 모의문제(예시문제)를 구조화한 문제풀이입니다.",
        kind: "quiz", status: "published", duration_minutes: 60,
        passing_score: 180, total_score: 300, fixed_order: true,
        certification_id: cert.id, published_at: new Date().toISOString(),
      })
      .select("id").single();
    if (examErr) throw new Error(`${slug} exam insert failed: ` + examErr.message);

    const sectionRows = Object.entries(SUBJECT_META).map(([sectionTitle, meta]) => ({
      exam_id: exam.id, code: meta.code, title: sectionTitle, max_score: 100, min_score: 40, sort_order: meta.sort,
    }));
    const { data: sections, error: sectionErr } = await admin.from("exam_sections").insert(sectionRows).select("id,code");
    if (sectionErr) throw new Error(`${slug} sections insert failed: ` + sectionErr.message);
    const sectionIdByCode = Object.fromEntries(sections.map((s) => [s.code, s.id]));

    for (let n = 1; n <= 60; n++) {
      const q = questions[String(n)];
      const sectionCode = SUBJECT_META[q.subject].code;
      const { data: inserted, error: qErr } = await admin.from("questions").insert({
        exam_id: exam.id, section_id: sectionIdByCode[sectionCode], number: n, type: "single_choice",
        prompt: q.stem, score: 5, difficulty: 2, competency_tags: [q.tag], is_active: true,
      }).select("id").single();
      if (qErr) throw new Error(`${slug} q${n} insert failed: ` + qErr.message);

      const choiceRows = q.choices.map((c, i) => ({
        question_id: inserted.id, label: String(i + 1), content: c.content, sort_order: i + 1,
      }));
      const { data: choices, error: choiceErr } = await admin.from("question_choices").insert(choiceRows).select("id,label");
      if (choiceErr) throw new Error(`${slug} q${n} choices insert failed: ` + choiceErr.message);
      const correctChoice = choices.find((c) => c.label === String(q.answer));
      if (!correctChoice) throw new Error(`${slug} q${n}: no choice matches answer ${q.answer}`);

      const { error: keyErr } = await admin.from("answer_keys").insert({
        question_id: inserted.id, grading_type: "exact", correct_choice_id: correctChoice.id,
      });
      if (keyErr) throw new Error(`${slug} q${n} answer_key insert failed: ` + keyErr.message);
    }
    console.log(`${slug}: seeded 60 questions (exam id ${exam.id})`);
  }
}

main().then(() => console.log("SEED DONE")).catch((err) => { console.error("SEED FAILED:", err.message); process.exit(1); });
