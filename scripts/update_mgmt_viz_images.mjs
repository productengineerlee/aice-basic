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

const IMAGE_DIR = "C:/Users/이태원/AppData/Local/Temp/claude/E--Projects-aice-basic/faedb522-94d8-4b7a-bde4-91765ecda1b6/scratchpad/question_images";
const BUCKET = "question-images";

// 스템(문항 지문) 자체가 그림/차트인 식별형 문항만 대상. 보기 옆 장식용 아이콘(4지선다 미니 썸네일)은
// 보기 텍스트만으로 이미 답변 가능해 제외했다.
const QUESTIONS_WITH_IMAGES = {
  A: [46, 50, 52, 53, 54, 55, 56, 57, 58, 59, 60],
  B: [45, 50, 52, 55, 56, 57, 58, 59, 60],
};

async function main() {
  let uploaded = 0;
  let updated = 0;

  for (const form of ["A", "B"]) {
    const slug = `mgmt-viz-${form.toLowerCase()}`;
    const exam = await admin.from("exams").select("id").eq("slug", slug).maybeSingle();
    if (!exam.data) throw new Error(`${slug}: exam not found`);

    const { data: dbQuestions, error: qErr } = await admin
      .from("questions")
      .select("id,number")
      .eq("exam_id", exam.data.id);
    if (qErr) throw new Error(`${slug} questions fetch failed: ` + qErr.message);
    const questionIdByNumber = new Map(dbQuestions.map((q) => [q.number, q.id]));

    for (const qnum of QUESTIONS_WITH_IMAGES[form]) {
      const questionId = questionIdByNumber.get(qnum);
      if (!questionId) throw new Error(`${slug} q${qnum}: no matching DB row`);

      const localPath = path.join(IMAGE_DIR, `${form.toLowerCase()}-${qnum}.png`);
      const fileBuffer = fs.readFileSync(localPath);
      const objectPath = `mgmt-viz-${form.toLowerCase()}/q${qnum}.png`;

      const { error: uploadError } = await admin.storage.from(BUCKET).upload(objectPath, fileBuffer, { contentType: "image/png", upsert: true });
      if (uploadError) throw new Error(`${slug} q${qnum} upload failed: ` + uploadError.message);
      uploaded++;

      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
      const { error: updateError } = await admin.from("questions").update({ image_url: urlData.publicUrl }).eq("id", questionId);
      if (updateError) throw new Error(`${slug} q${qnum} image_url update failed: ` + updateError.message);
      updated++;
    }
    console.log(`${slug}: uploaded/updated ${QUESTIONS_WITH_IMAGES[form].length} question images`);
  }

  console.log(`total uploaded: ${uploaded}, total updated: ${updated}`);
}

main().then(() => console.log("IMAGE UPDATE DONE")).catch((err) => { console.error("IMAGE UPDATE FAILED:", err.message); process.exit(1); });
