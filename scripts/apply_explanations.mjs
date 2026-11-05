// data/explanations/<시험slug>.json 의 해설을 검사하고 answer_keys.explanation 에 반영한다.
// 사용:
//   node scripts/apply_explanations.mjs              검사만 (DB 쓰기 없음)
//   node scripts/apply_explanations.mjs --apply      비어 있는 해설만 채움 (관리자가 고친 해설은 보존)
//   node scripts/apply_explanations.mjs --apply --overwrite   기존 해설도 덮어씀
//   뒤에 slug 를 붙이면 그 시험지만 처리
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
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const overwrite = args.includes("--overwrite");
const onlySlugs = args.filter((a) => !a.startsWith("--"));
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const CIRCLED = ["①", "②", "③", "④", "⑤"];
const MAX_LENGTH = 1200;
const dir = path.join(root, "data", "explanations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).filter((f) => !onlySlugs.length || onlySlugs.includes(f.replace(/\.json$/, "")));

async function must(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

let errorCount = 0, written = 0, skipped = 0;
for (const file of files) {
  const doc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const slug = doc.slug ?? file.replace(/\.json$/, "");
  const errors = [], warnings = [];

  const exam = await must(admin.from("exams").select("id").eq("slug", slug).maybeSingle(), "exam");
  if (!exam) { console.log(`✗ ${slug}: 시험을 찾을 수 없음`); errorCount++; continue; }
  const questions = await must(admin.from("questions").select("id,number").eq("exam_id", exam.id).eq("is_active", true), "questions");
  const ids = questions.map((q) => q.id);
  const choices = await must(admin.from("question_choices").select("id,question_id,sort_order").in("question_id", ids).order("sort_order"), "choices");
  const keys = await must(admin.from("answer_keys").select("question_id,correct_choice_id,explanation").in("question_id", ids), "answer_keys");
  const keyById = new Map(keys.map((k) => [k.question_id, k]));
  const numberById = new Map(questions.map((q) => [q.id, q.number]));

  const seen = new Set();
  const updates = [];
  for (const item of doc.explanations ?? []) {
    const label = `${slug} ${item.number}번`;
    const number = numberById.get(item.question_id);
    if (number === undefined) { errors.push(`${label}: question_id 가 이 시험에 없음`); continue; }
    if (number !== item.number) errors.push(`${label}: 번호 불일치 (DB ${number}번)`);
    if (seen.has(item.question_id)) errors.push(`${label}: 중복`);
    seen.add(item.question_id);

    const text = String(item.explanation ?? "").replace(/\r\n/g, "\n").trim();
    const qChoices = choices.filter((c) => c.question_id === item.question_id);
    const correctIndex = qChoices.findIndex((c) => c.id === keyById.get(item.question_id)?.correct_choice_id);
    const expectedHead = `정답 ${CIRCLED[correctIndex]}`;
    const head = text.split("\n")[0].trim();
    if (head !== expectedHead) errors.push(`${label}: 첫 줄 "${head}" ≠ "${expectedHead}"`);
    if (/\*\*|^#|^- /m.test(text)) errors.push(`${label}: 마크다운 기호 포함`);
    if (text.length > MAX_LENGTH) warnings.push(`${label}: ${text.length}자로 김`);
    if (text.length < 40) errors.push(`${label}: 너무 짧음`);
    const missingMarks = qChoices.map((_, i) => CIRCLED[i]).filter((mark) => !text.slice(head.length).includes(mark));
    const groupedChoices = /^ㄱ/m.test(text) || /[①②③④⑤]\s*~\s*[①②③④⑤]/.test(text); // 〈보기〉 조합형·순서형은 보기를 묶어 설명한다
    if (missingMarks.length && !groupedChoices) warnings.push(`${label}: 보기 ${missingMarks.join("")} 설명 없음`);
    updates.push({ question_id: item.question_id, text, existing: keyById.get(item.question_id)?.explanation?.trim() ?? "" });
  }
  const missing = questions.filter((q) => !seen.has(q.id)).map((q) => q.number).sort((a, b) => a - b);
  if (missing.length) errors.push(`${slug}: 해설 없는 문항 ${missing.join(",")}`);

  const flags = doc.flags ?? [];
  console.log(`${errors.length ? "✗" : "✓"} ${slug}: ${updates.length}/${questions.length}문항, 오류 ${errors.length}, 경고 ${warnings.length}, 플래그 ${flags.length}`);
  for (const e of errors) console.log(`   오류 ${e}`);
  for (const w of warnings) console.log(`   경고 ${w}`);
  for (const f of flags) console.log(`   플래그 ${f.number}번: ${f.note}`);
  errorCount += errors.length;

  if (!apply || errors.length) continue;
  for (const u of updates) {
    if (u.existing && !overwrite) { skipped++; continue; }
    if (u.existing === u.text) { skipped++; continue; }
    const { error } = await admin.from("answer_keys").update({ explanation: u.text }).eq("question_id", u.question_id);
    if (error) throw new Error(`${slug} 반영 실패: ${error.message}`);
    written++;
  }
}

console.log(apply ? `반영 ${written}건, 건너뜀 ${skipped}건${errorCount ? ` (오류 있는 시험지는 반영 안 함: ${errorCount}건)` : ""}` : `검사만 했습니다. 오류 ${errorCount}건. 반영하려면 --apply`);
if (errorCount) process.exitCode = 1;
