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

const SLUGS = ["korean-history-76-simhwa", "korean-history-77-simhwa", "korean-history-78-simhwa", "korean-history-79-simhwa"];
const FABRICATED_RE = /\n\(문제 이미지의 [^)]*\.\)/;

async function main() {
  let totalChecked = 0;
  let totalFixed = 0;
  for (const slug of SLUGS) {
    const exam = await admin.from("exams").select("id").eq("slug", slug).maybeSingle();
    if (!exam.data) throw new Error(`${slug}: exam not found`);

    const { data: qs, error: qErr } = await admin.from("questions").select("id,number,prompt").eq("exam_id", exam.data.id);
    if (qErr) throw new Error(`${slug} questions fetch failed: ` + qErr.message);

    for (const q of qs) {
      totalChecked++;
      if (!FABRICATED_RE.test(q.prompt)) continue;
      const newPrompt = q.prompt.replace(FABRICATED_RE, "");
      const { error: updErr } = await admin.from("questions").update({ prompt: newPrompt }).eq("id", q.id);
      if (updErr) throw new Error(`${slug} q${q.number} prompt update failed: ` + updErr.message);
      console.log(`${slug} q${q.number}: "${q.prompt}" -> "${newPrompt}"`);
      totalFixed++;
    }
  }
  console.log(`checked ${totalChecked} questions across ${SLUGS.length} exams, fixed ${totalFixed}`);
}

main().then(() => console.log("FIX DONE")).catch((err) => {
  console.error("FIX FAILED:", err.message);
  process.exit(1);
});
