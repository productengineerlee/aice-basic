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

// 각 항목: {subjectKey(원본 JSON의 subject 필드값), 파일, 문항수, section code/title/sort}
const SECTIONS = [
  { file: "2cha-1gyosi.json", subjectKey: "중개사법령및중개실무", keyStart: 1, keyEnd: 40, code: "brokerage-law", title: "공인중개사의 업무 및 부동산 거래신고 등에 관한 법령 및 중개실무", sort: 1 },
  { file: "2cha-1gyosi.json", subjectKey: "부동산공법", keyStart: 41, keyEnd: 80, code: "real-estate-law", title: "부동산공법 중 부동산 중개에 관련되는 규정", sort: 2 },
  { file: "2cha-2gyosi.json", subjectKey: "부동산공시법령및세법", keyStart: 1, keyEnd: 40, code: "registration-tax", title: "부동산공시에 관한 법령 및 부동산 관련 세법", sort: 3 },
];

async function main() {
  const { data: cert, error: certErr } = await admin
    .from("certifications")
    .select("id")
    .eq("code", "gongin")
    .single();
  if (certErr) throw new Error("certification lookup failed: " + certErr.message);

  const slug = "gongin-2025-2cha";
  const title = "2025년 제36회 공인중개사 2차 기출문제";

  const existing = await admin.from("exams").select("id").eq("slug", slug).maybeSingle();
  if (existing.data) { console.log(`skip ${slug}: already exists (id=${existing.data.id})`); return; }

  const dataByFile = new Map();
  for (const section of SECTIONS) {
    if (!dataByFile.has(section.file)) {
      dataByFile.set(section.file, JSON.parse(fs.readFileSync(path.join(root, "data", "gongin", section.file), "utf8")));
    }
  }

  const { data: exam, error: examErr } = await admin
    .from("exams")
    .insert({
      slug, title,
      description: "2025년 제36회 공인중개사 2차(1교시·2교시) 기출문제입니다.",
      kind: "quiz", status: "published", duration_minutes: 150,
      passing_score: 180, total_score: 300, fixed_order: true,
      certification_id: cert.id, published_at: new Date().toISOString(),
    })
    .select("id").single();
  if (examErr) throw new Error(`${slug} exam insert failed: ` + examErr.message);

  const sectionRows = SECTIONS.map((s) => ({
    exam_id: exam.id, code: s.code, title: s.title, max_score: 100, min_score: 40, sort_order: s.sort,
  }));
  const { data: sections, error: sectionErr } = await admin.from("exam_sections").insert(sectionRows).select("id,code");
  if (sectionErr) throw new Error(`${slug} sections insert failed: ` + sectionErr.message);
  const sectionIdByCode = Object.fromEntries(sections.map((s) => [s.code, s.id]));

  let questionNumber = 0;
  for (const section of SECTIONS) {
    const questions = dataByFile.get(section.file);
    for (let n = section.keyStart; n <= section.keyEnd; n++) {
      const q = questions[String(n)];
      if (q.subject !== section.subjectKey) throw new Error(`${slug} ${section.file} q${n}: subject mismatch (${q.subject} != ${section.subjectKey})`);
      questionNumber++;
      const { data: inserted, error: qErr } = await admin.from("questions").insert({
        exam_id: exam.id, section_id: sectionIdByCode[section.code], number: questionNumber, type: "single_choice",
        prompt: q.stem, score: 2.5, difficulty: 2, competency_tags: [q.tag], is_active: true,
      }).select("id").single();
      if (qErr) throw new Error(`${slug} q${questionNumber} insert failed: ` + qErr.message);

      const choiceRows = q.choices.map((c) => ({
        question_id: inserted.id, label: String(c.label), content: c.content, sort_order: c.label,
      }));
      const { data: choices, error: choiceErr } = await admin.from("question_choices").insert(choiceRows).select("id,label");
      if (choiceErr) throw new Error(`${slug} q${questionNumber} choices insert failed: ` + choiceErr.message);
      const correctChoice = choices.find((c) => c.label === String(q.answer));
      if (!correctChoice) throw new Error(`${slug} q${questionNumber}: no choice matches answer ${q.answer}`);

      const { error: keyErr } = await admin.from("answer_keys").insert({
        question_id: inserted.id, grading_type: "exact", correct_choice_id: correctChoice.id,
      });
      if (keyErr) throw new Error(`${slug} q${questionNumber} answer_key insert failed: ` + keyErr.message);
    }
  }
  console.log(`${slug}: seeded ${questionNumber} questions (exam id ${exam.id})`);
}

main().then(() => console.log("SEED DONE")).catch((err) => { console.error("SEED FAILED:", err.message); process.exit(1); });
