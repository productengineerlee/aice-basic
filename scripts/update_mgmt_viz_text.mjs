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
  let stemUpdates = 0;
  let choiceUpdates = 0;

  for (const form of ["A", "B"]) {
    const slug = `mgmt-viz-${form.toLowerCase()}`;
    const questions = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `form-${form.toLowerCase()}.json`), "utf8"));

    const exam = await admin.from("exams").select("id").eq("slug", slug).maybeSingle();
    if (!exam.data) throw new Error(`${slug}: exam not found — run seed_mgmt_viz.mjs first`);
    const examId = exam.data.id;

    const { data: dbQuestions, error: qErr } = await admin
      .from("questions")
      .select("id,number,prompt")
      .eq("exam_id", examId);
    if (qErr) throw new Error(`${slug} questions fetch failed: ` + qErr.message);
    const dbQuestionByNumber = new Map(dbQuestions.map((q) => [q.number, q]));

    for (let n = 1; n <= 60; n++) {
      const q = questions[String(n)];
      const dbQ = dbQuestionByNumber.get(n);
      if (!dbQ) throw new Error(`${slug} q${n}: no matching DB row`);

      if (dbQ.prompt !== q.stem) {
        const { error } = await admin.from("questions").update({ prompt: q.stem }).eq("id", dbQ.id);
        if (error) throw new Error(`${slug} q${n} prompt update failed: ` + error.message);
        stemUpdates++;
      }

      const { data: dbChoices, error: cErr } = await admin
        .from("question_choices")
        .select("id,label,content")
        .eq("question_id", dbQ.id);
      if (cErr) throw new Error(`${slug} q${n} choices fetch failed: ` + cErr.message);
      const dbChoiceByLabel = new Map(dbChoices.map((c) => [c.label, c]));

      for (let i = 0; i < q.choices.length; i++) {
        const label = String(i + 1);
        const dbC = dbChoiceByLabel.get(label);
        if (!dbC) throw new Error(`${slug} q${n} choice ${label}: no matching DB row`);
        if (dbC.content !== q.choices[i].content) {
          const { error } = await admin.from("question_choices").update({ content: q.choices[i].content }).eq("id", dbC.id);
          if (error) throw new Error(`${slug} q${n} choice ${label} update failed: ` + error.message);
          choiceUpdates++;
        }
      }
    }
    console.log(`${slug}: checked 60 questions`);
  }

  console.log(`stem updates: ${stemUpdates}, choice updates: ${choiceUpdates}`);
}

main().then(() => console.log("UPDATE DONE")).catch((err) => { console.error("UPDATE FAILED:", err.message); process.exit(1); });
