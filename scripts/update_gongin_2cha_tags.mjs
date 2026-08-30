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

// 문항 번호(1~120, 시딩 시 이어붙인 연속번호) -> 원본 JSON 파일/키 매핑
const RANGES = [
  { start: 1, end: 40, file: "2cha-1gyosi.json", key: (n) => n },
  { start: 41, end: 80, file: "2cha-1gyosi.json", key: (n) => n },
  { start: 81, end: 120, file: "2cha-2gyosi.json", key: (n) => n - 80 },
];

function tagFor(dataByFile, questionNumber) {
  const range = RANGES.find((r) => questionNumber >= r.start && questionNumber <= r.end);
  const data = dataByFile.get(range.file);
  return data[String(range.key(questionNumber))].tag;
}

async function main() {
  const dataByFile = new Map();
  for (const file of new Set(RANGES.map((r) => r.file))) {
    dataByFile.set(file, JSON.parse(fs.readFileSync(path.join(root, "data", "gongin", file), "utf8")));
  }

  const exam = await admin.from("exams").select("id").eq("slug", "gongin-2025-2cha").single();
  if (!exam.data) throw new Error("gongin-2025-2cha exam not found");

  const { data: questions, error } = await admin.from("questions").select("id,number").eq("exam_id", exam.data.id);
  if (error) throw new Error("questions fetch failed: " + error.message);

  let updated = 0;
  for (const q of questions) {
    const tag = tagFor(dataByFile, q.number);
    const { error: updErr } = await admin.from("questions").update({ competency_tags: [tag] }).eq("id", q.id);
    if (updErr) throw new Error(`q${q.number} tag update failed: ` + updErr.message);
    updated++;
  }
  console.log(`updated tags for ${updated} questions`);
}

main().then(() => console.log("TAG UPDATE DONE")).catch((err) => { console.error("TAG UPDATE FAILED:", err.message); process.exit(1); });
