// 사회복지사 1급 기출(20~24회, 회차당 3교시 200문항)을 등록한다.
// 사용: node scripts/seed_sabok.mjs            → 자격증은 숨김(is_active=false) 상태로 등록
//       node scripts/seed_sabok.mjs --activate → 해설까지 채운 뒤 자격증을 공개
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

const CERT = { code: "sabok1", name: "사회복지사 1급", description: "사회복지사 1급 국가시험 기출문제 기반 문제풀이", sort_order: 4 };
const ROUNDS = { 20: 2022, 21: 2023, 22: 2024, 23: 2025, 24: 2026 };
// 과목마다 25문항·25점, 과목별 40%(10점) 미만이면 과락
const SECTIONS = [
  { title: "인간행동과 사회환경", code: "hbse", sort: 1 },
  { title: "사회복지조사론", code: "research", sort: 2 },
  { title: "사회복지실천론", code: "practice", sort: 3 },
  { title: "사회복지실천기술론", code: "practice-skills", sort: 4 },
  { title: "지역사회복지론", code: "community", sort: 5 },
  { title: "사회복지정책론", code: "policy", sort: 6 },
  { title: "사회복지행정론", code: "administration", sort: 7 },
  { title: "사회복지법제론", code: "law", sort: 8 },
];

async function seedRound(certId, round) {
  const year = ROUNDS[round];
  const slug = `sabok1-${round}`;
  const existing = await admin.from("exams").select("id").eq("slug", slug).maybeSingle();
  if (existing.data) {
    console.log(`skip ${slug}: already exists`);
    return;
  }
  const questions = JSON.parse(fs.readFileSync(path.join(root, "data", "sabok", `${round}.json`), "utf8"));

  const { data: exam, error: examErr } = await admin.from("exams").insert({
    slug,
    title: `${year}년 제${round}회 사회복지사 1급 기출문제`,
    description: `${year}년 제${round}회 사회복지사 1급 국가시험 1~3교시 기출문제(8과목 200문항)입니다.`,
    kind: "quiz", status: "published", duration_minutes: 200,
    passing_score: 120, total_score: 200, fixed_order: true,
    certification_id: certId, published_at: new Date().toISOString(),
  }).select("id").single();
  if (examErr) throw new Error(`${slug} exam insert failed: ` + examErr.message);

  const { data: sections, error: sectionErr } = await admin.from("exam_sections").insert(
    SECTIONS.map((s) => ({ exam_id: exam.id, code: s.code, title: s.title, max_score: 25, min_score: 10, sort_order: s.sort })),
  ).select("id,title");
  if (sectionErr) throw new Error(`${slug} sections insert failed: ` + sectionErr.message);
  const sectionId = Object.fromEntries(sections.map((s) => [s.title, s.id]));

  for (let n = 1; n <= 200; n++) {
    const q = questions[String(n)];
    if (!sectionId[q.subject]) throw new Error(`${slug} q${n}: unknown subject ${q.subject}`);
    const { data: inserted, error: qErr } = await admin.from("questions").insert({
      exam_id: exam.id, section_id: sectionId[q.subject], number: n, type: "single_choice",
      prompt: q.stem, score: 1, difficulty: 2, competency_tags: [q.tag], is_active: true,
    }).select("id").single();
    if (qErr) throw new Error(`${slug} q${n} insert failed: ` + qErr.message);

    const { data: choices, error: choiceErr } = await admin.from("question_choices").insert(
      q.choices.map((c) => ({ question_id: inserted.id, label: String(c.label), content: c.content, sort_order: c.label })),
    ).select("id,label");
    if (choiceErr) throw new Error(`${slug} q${n} choices insert failed: ` + choiceErr.message);
    const correct = choices.find((c) => c.label === String(q.answer));
    if (!correct) throw new Error(`${slug} q${n}: no choice matches answer ${q.answer}`);

    // 복수 정답(공단 확정정답에서 여러 보기를 정답 처리한 문항)은 accepted_values 에 보기 번호를 함께 둔다
    const { error: keyErr } = await admin.from("answer_keys").insert({
      question_id: inserted.id, grading_type: "exact", correct_choice_id: correct.id,
      accepted_values: (q.acceptedAnswers ?? []).map(String),
    });
    if (keyErr) throw new Error(`${slug} q${n} answer_key insert failed: ` + keyErr.message);
  }
  console.log(`${slug}: seeded 200 questions`);
}

async function main() {
  const activate = process.argv.includes("--activate");
  const current = await admin.from("certifications").select("id,is_active").eq("code", CERT.code).maybeSingle();
  const { data: cert, error: certErr } = await admin.from("certifications")
    .upsert({ ...CERT, is_active: activate || Boolean(current.data?.is_active) }, { onConflict: "code" })
    .select("id,is_active").single();
  if (certErr) throw new Error("certification upsert failed: " + certErr.message);
  console.log("certification", cert.id, "active:", cert.is_active);
  for (const round of Object.keys(ROUNDS).map(Number)) await seedRound(cert.id, round);
}

main().then(() => console.log("SEED DONE")).catch((err) => {
  console.error("SEED FAILED:", err.message);
  process.exit(1);
});
