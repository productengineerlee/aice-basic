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

const SECTION_META = {
  "선사·초기국가": { code: "prehistory", sort: 1 },
  "고대": { code: "ancient", sort: 2 },
  "고려": { code: "goryeo", sort: 3 },
  "조선전기": { code: "joseon-early", sort: 4 },
  "조선후기": { code: "joseon-late", sort: 5 },
  "근대": { code: "modern", sort: 6 },
  "일제강점기": { code: "japanese-colonial", sort: 7 },
  "현대": { code: "contemporary", sort: 8 },
  "시대통합": { code: "integrated", sort: 9 },
};

async function main() {
  const { data: cert, error: certErr } = await admin
    .from("certifications")
    .upsert(
      { code: "korean-history", name: "한국사능력검정시험", description: "한국사능력검정시험 심화 기출문제 기반 문제풀이", is_active: true, sort_order: 3 },
      { onConflict: "code" },
    )
    .select("id")
    .single();
  if (certErr) throw new Error("certification upsert failed: " + certErr.message);
  console.log("certification id:", cert.id);

  const slug = "korean-history-78-simhwa";
  const title = "제78회 한국사능력검정시험 심화 기출문제";

  const existing = await admin.from("exams").select("id").eq("slug", slug).maybeSingle();
  if (existing.data) {
    console.log(`skip ${slug}: already exists (id=${existing.data.id})`);
    return;
  }

  const questions = JSON.parse(fs.readFileSync(path.join(root, "data", "korean-history", "78-simhwa.json"), "utf8"));

  const { data: exam, error: examErr } = await admin
    .from("exams")
    .insert({
      slug,
      title,
      description: "제78회 한국사능력검정시험 심화 등급 기출문제(50문항, 100점)입니다.",
      kind: "quiz",
      status: "published",
      duration_minutes: 80,
      passing_score: 60,
      total_score: 100,
      fixed_order: true,
      certification_id: cert.id,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (examErr) throw new Error(`${slug} exam insert failed: ` + examErr.message);

  const sectionMaxScore = {};
  for (const q of Object.values(questions)) {
    sectionMaxScore[q.section] = (sectionMaxScore[q.section] ?? 0) + q.score;
  }
  const sectionRows = Object.entries(SECTION_META).map(([title, meta]) => ({
    exam_id: exam.id,
    code: meta.code,
    title,
    max_score: sectionMaxScore[title] ?? 0,
    sort_order: meta.sort,
  }));
  const { data: sections, error: sectionErr } = await admin.from("exam_sections").insert(sectionRows).select("id,code");
  if (sectionErr) throw new Error(`${slug} sections insert failed: ` + sectionErr.message);
  const sectionIdByTitle = Object.fromEntries(
    sections.map((s) => {
      const titleForCode = Object.entries(SECTION_META).find(([, meta]) => meta.code === s.code)?.[0];
      return [titleForCode, s.id];
    }),
  );

  for (let n = 1; n <= 50; n++) {
    const q = questions[String(n)];
    const sectionId = sectionIdByTitle[q.section];
    if (!sectionId) throw new Error(`${slug} q${n}: unknown section ${q.section}`);

    const { data: inserted, error: qErr } = await admin
      .from("questions")
      .insert({
        exam_id: exam.id,
        section_id: sectionId,
        number: n,
        type: "single_choice",
        prompt: q.stem,
        score: q.score,
        difficulty: 2,
        competency_tags: [q.tag],
        is_active: true,
      })
      .select("id")
      .single();
    if (qErr) throw new Error(`${slug} q${n} insert failed: ` + qErr.message);

    const choiceRows = q.choices.map((c) => ({
      question_id: inserted.id,
      label: String(c.label),
      content: c.content,
      sort_order: c.label,
    }));
    const { data: choices, error: choiceErr } = await admin.from("question_choices").insert(choiceRows).select("id,label");
    if (choiceErr) throw new Error(`${slug} q${n} choices insert failed: ` + choiceErr.message);
    const correctChoice = choices.find((c) => c.label === String(q.answer));
    if (!correctChoice) throw new Error(`${slug} q${n}: no choice matches answer ${q.answer}`);

    const { error: keyErr } = await admin.from("answer_keys").insert({
      question_id: inserted.id,
      grading_type: "exact",
      correct_choice_id: correctChoice.id,
    });
    if (keyErr) throw new Error(`${slug} q${n} answer_key insert failed: ` + keyErr.message);
  }

  console.log(`${slug}: seeded 50 questions (exam id ${exam.id}). Run update_korean_history_78_images.mjs separately to attach question images.`);
}

main().then(() => console.log("SEED DONE")).catch((err) => {
  console.error("SEED FAILED:", err.message);
  process.exit(1);
});
