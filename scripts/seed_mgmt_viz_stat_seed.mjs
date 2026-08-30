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

const DATA_DIR = path.join(root, "data", "mgmt-viz");

async function main() {
  // 구글폼 응답 240(A형)+69(B형)건을 문항별 정오로 집계한 익명 통계.
  // 원본에는 응답 시각/이메일 등 식별 정보가 있었으나 이 집계 단계에서 전혀 읽지 않았고,
  // 여기서 쓰는 값은 문항별 attempt_count/correct_count 숫자뿐이다.
  const seedCounts = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "gform_seed_counts.json"), "utf8"));

  let inserted = 0;
  for (const form of ["A", "B"]) {
    const slug = `mgmt-viz-${form.toLowerCase()}`;
    const exam = await admin.from("exams").select("id").eq("slug", slug).maybeSingle();
    if (!exam.data) throw new Error(`${slug}: exam not found — run seed_mgmt_viz.mjs first`);

    const { data: dbQuestions, error: qErr } = await admin
      .from("questions")
      .select("id,number")
      .eq("exam_id", exam.data.id);
    if (qErr) throw new Error(`${slug} questions fetch failed: ` + qErr.message);
    const questionIdByNumber = new Map(dbQuestions.map((q) => [q.number, q.id]));

    const counts = seedCounts[form];
    for (let n = 1; n <= 60; n++) {
      const questionId = questionIdByNumber.get(n);
      if (!questionId) throw new Error(`${slug} q${n}: no matching DB row`);
      const c = counts[String(n)];
      const { error } = await admin
        .from("question_stat_seed")
        .upsert({ question_id: questionId, attempt_count: c.attempt, correct_count: c.correct }, { onConflict: "question_id" });
      if (error) throw new Error(`${slug} q${n} stat seed upsert failed: ` + error.message);
      inserted++;
    }
    console.log(`${slug}: seeded stats for 60 questions`);
  }
  console.log(`total rows upserted: ${inserted}`);
}

main().then(() => console.log("STAT SEED DONE")).catch((err) => { console.error("STAT SEED FAILED:", err.message); process.exit(1); });
