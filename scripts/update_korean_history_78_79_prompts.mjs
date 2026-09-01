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

async function updateExam(slug, jsonFile) {
  const exam = await admin.from("exams").select("id").eq("slug", slug).maybeSingle();
  if (!exam.data) throw new Error(`${slug}: exam not found`);

  const { data: dbQuestions, error: qErr } = await admin.from("questions").select("id,number").eq("exam_id", exam.data.id);
  if (qErr) throw new Error(`${slug} questions fetch failed: ` + qErr.message);
  const questionIdByNumber = new Map(dbQuestions.map((q) => [q.number, q.id]));

  const questions = JSON.parse(fs.readFileSync(path.join(root, "data", "korean-history", jsonFile), "utf8"));

  let updated = 0;
  for (const [numStr, q] of Object.entries(questions)) {
    const n = parseInt(numStr);
    const questionId = questionIdByNumber.get(n);
    if (!questionId) throw new Error(`${slug} q${n}: no matching DB row`);
    const { error } = await admin.from("questions").update({ prompt: q.stem }).eq("id", questionId);
    if (error) throw new Error(`${slug} q${n} prompt update failed: ` + error.message);
    updated++;
  }
  console.log(`${slug}: updated ${updated} prompts`);
}

async function main() {
  await updateExam("korean-history-78-simhwa", "78-simhwa.json");
  await updateExam("korean-history-79-simhwa", "79-simhwa.json");
}

main().then(() => console.log("PROMPT UPDATE DONE")).catch((err) => {
  console.error("PROMPT UPDATE FAILED:", err.message);
  process.exit(1);
});
