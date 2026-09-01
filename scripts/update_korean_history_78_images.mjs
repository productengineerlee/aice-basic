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

const SLUG = "korean-history-78-simhwa";
const BUCKET = "question-images";
const CROPS_DIR = "C:/Users/이태원/AppData/Local/Temp/claude/E--Projects-aice-basic/84dc18de-47bd-4d16-bae3-997b751a17bc/scratchpad/qcrops78";

async function main() {
  const exam = await admin.from("exams").select("id").eq("slug", SLUG).maybeSingle();
  if (!exam.data) throw new Error(`${SLUG}: exam not found`);

  const { data: dbQuestions, error: qErr } = await admin.from("questions").select("id,number").eq("exam_id", exam.data.id);
  if (qErr) throw new Error(`${SLUG} questions fetch failed: ` + qErr.message);
  const questionIdByNumber = new Map(dbQuestions.map((q) => [q.number, q.id]));

  const files = fs.readdirSync(CROPS_DIR).filter((f) => /^q\d+\.png$/.test(f));
  let uploaded = 0;
  let updated = 0;

  for (const file of files) {
    const qnum = parseInt(file.match(/^q(\d+)\.png$/)[1]);
    const questionId = questionIdByNumber.get(qnum);
    if (!questionId) throw new Error(`${SLUG} q${qnum}: no matching DB row`);

    const fileBuffer = fs.readFileSync(path.join(CROPS_DIR, file));
    const objectPath = `${SLUG}/q${qnum}.png`;

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(objectPath, fileBuffer, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`${SLUG} q${qnum} upload failed: ` + uploadError.message);
    uploaded++;

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
    const versionedUrl = `${urlData.publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await admin.from("questions").update({ image_url: versionedUrl }).eq("id", questionId);
    if (updateError) throw new Error(`${SLUG} q${qnum} image_url update failed: ` + updateError.message);
    updated++;
  }

  console.log(`uploaded: ${uploaded}, updated: ${updated}`);
}

main().then(() => console.log("IMAGE UPDATE DONE")).catch((err) => {
  console.error("IMAGE UPDATE FAILED:", err.message);
  process.exit(1);
});
