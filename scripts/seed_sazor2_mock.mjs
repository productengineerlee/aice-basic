// 사회조사분석사 2급 필기 예상문제(기출 아님)를 등록한다. 출제기준(2027.1~2030.12) 기반, 3과목 80문항·4지선다.
// 사용: node scripts/seed_sazor2_mock.mjs 01             → data/sazor2/mock-01.json 을 slug sazor2-mock-01 로 등록(자격증은 숨김)
//       node scripts/seed_sazor2_mock.mjs 01 --activate  → 자격증 공개
// slug 의 "-mock-" 으로 기출과 구분한다(src/lib/certifications.ts isMockExamSlug).
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

const CERT = { code: "sazor2", name: "사회조사분석사 2급", description: "사회조사분석사 2급 필기 출제기준(2027~2030)에 맞춘 예상문제", sort_order: 5 };
// 과목별 최소 40%(과락), 전체 60% 이상 합격. 문항당 1점.
const SECTIONS = [
  { title: "조사방법과 설계", code: "research-design", max: 25, min: 10, sort: 1 },
  { title: "조사관리와 자료처리", code: "data-management", max: 25, min: 10, sort: 2 },
  { title: "통계분석과 활용", code: "statistics", max: 30, min: 12, sort: 3 },
];

async function main() {
  const set = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "01";
  const activate = process.argv.includes("--activate");
  const slug = `sazor2-mock-${set}`;
  const questions = JSON.parse(fs.readFileSync(path.join(root, "data", "sazor2", `mock-${set}.json`), "utf8"));
  const count = Object.keys(questions).length;
  if (count !== 80) throw new Error(`${slug}: 80문항이어야 하는데 ${count}문항`);

  const { data: cert, error: certErr } = await admin.from("certifications").upsert({ ...CERT, is_active: activate }, { onConflict: "code" }).select("id").single();
  if (certErr) throw new Error("certification upsert failed: " + certErr.message);

  const existing = await admin.from("exams").select("id").eq("slug", slug).maybeSingle();
  if (existing.data) {
    console.log(`skip ${slug}: already exists`);
    return;
  }

  const { data: exam, error: examErr } = await admin.from("exams").insert({
    slug,
    title: `사회조사분석사 2급 필기 예상문제 제${Number(set)}회`,
    description: "2027~2030년 출제기준에 맞춰 만든 예상문제(3과목 80문항)입니다. 실제 기출문제가 아닙니다.",
    kind: "quiz", status: "published", duration_minutes: 120,
    passing_score: 48, total_score: 80, fixed_order: true,
    certification_id: cert.id, published_at: new Date().toISOString(),
  }).select("id").single();
  if (examErr) throw new Error(`${slug} exam insert failed: ` + examErr.message);

  const { data: sections, error: sectionErr } = await admin.from("exam_sections").insert(
    SECTIONS.map((s) => ({ exam_id: exam.id, code: s.code, title: s.title, max_score: s.max, min_score: s.min, sort_order: s.sort })),
  ).select("id,title");
  if (sectionErr) throw new Error(`${slug} sections insert failed: ` + sectionErr.message);
  const sectionId = Object.fromEntries(sections.map((s) => [s.title, s.id]));

  for (let n = 1; n <= count; n++) {
    const q = questions[String(n)];
    if (!sectionId[q.subject]) throw new Error(`${slug} q${n}: unknown subject ${q.subject}`);
    const { data: inserted, error: qErr } = await admin.from("questions").insert({
      exam_id: exam.id, section_id: sectionId[q.subject], number: n, type: "single_choice",
      prompt: q.stem, score: 1, difficulty: 2, competency_tags: [q.tag], is_active: true,
    }).select("id").single();
    if (qErr) throw new Error(`${slug} q${n} insert failed: ` + qErr.message);

    const { data: choices, error: choiceErr } = await admin.from("question_choices").insert(
      q.choices.map((content, i) => ({ question_id: inserted.id, label: String(i + 1), content, sort_order: i + 1 })),
    ).select("id,label");
    if (choiceErr) throw new Error(`${slug} q${n} choices insert failed: ` + choiceErr.message);
    const correct = choices.find((c) => c.label === String(q.answer));
    if (!correct) throw new Error(`${slug} q${n}: no choice matches answer ${q.answer}`);

    const { error: keyErr } = await admin.from("answer_keys").insert({
      question_id: inserted.id, grading_type: "exact", correct_choice_id: correct.id, explanation: q.explanation,
    });
    if (keyErr) throw new Error(`${slug} q${n} answer_key insert failed: ` + keyErr.message);
  }
  console.log(`${slug}: seeded ${count} questions`);
}

main().then(() => console.log("SEED DONE")).catch((err) => {
  console.error("SEED FAILED:", err.message);
  process.exit(1);
});
