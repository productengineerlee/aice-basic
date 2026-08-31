import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

for (const raw of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const index = line.indexOf("=");
  const key = line.slice(0, index).trim();
  let value = line.slice(index + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!process.env[key]) process.env[key] = value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const base = "http://127.0.0.1:3000";
const SLUG = "korean-history-78-simhwa";

async function makeSession() {
  const stamp = Date.now() + Math.random();
  const email = `codex-korean-history-78-${stamp}@example.invalid`;
  const password = `Cdx!${crypto.randomBytes(18).toString("base64url")}`;
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { birth_date: "1990-01-02", terms_version: "2026-08-01", privacy_version: "2026-08-01" },
  });
  if (created.error) throw created.error;
  const userId = created.data.user.id;
  const cookies = [];
  const ssr = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookies,
      setAll(items) {
        for (const item of items) {
          const idx = cookies.findIndex((c) => c.name === item.name);
          if (!item.value) { if (idx >= 0) cookies.splice(idx, 1); }
          else if (idx >= 0) cookies[idx] = { name: item.name, value: item.value };
          else cookies.push({ name: item.name, value: item.value });
        }
      },
    },
  });
  const signed = await ssr.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw signed.error ?? new Error("SSR cookie missing");
  const cookieHeader = () => cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
  async function api(routePath, options = {}) {
    const response = await fetch(`${base}${routePath}`, { ...options, headers: { Cookie: cookieHeader(), ...(options.headers ?? {}) } });
    const data = await response.json();
    if (!response.ok) throw new Error(`${routePath}:${response.status}:${JSON.stringify(data)}`);
    return data;
  }
  return { userId, api };
}

async function cleanup(userId, attemptId) {
  if (userId) await admin.auth.admin.deleteUser(userId);
  if (attemptId) await admin.from("attempts").delete().eq("id", attemptId);
}

async function run(label, buildAnswers) {
  let userId, attemptId;
  try {
    const { data: exam } = await admin.from("exams").select("id").eq("slug", SLUG).single();
    const { data: questions } = await admin.from("questions").select("id,number,section_id,image_url").eq("exam_id", exam.id).order("number");
    const questionIds = questions.map((q) => q.id);
    const { data: keys } = await admin.from("answer_keys").select("question_id,correct_choice_id").in("question_id", questionIds);
    const { data: choices } = await admin.from("question_choices").select("id,question_id,label").in("question_id", questionIds);
    const keyByQuestion = new Map(keys.map((k) => [k.question_id, k]));
    const choiceById = new Map(choices.map((c) => [c.id, c]));

    const imageQuestions = questions.filter((q) => q.image_url);
    console.log(`questions with image_url: ${imageQuestions.map((q) => q.number).join(", ")}`);

    const answers = buildAnswers(questions, keyByQuestion, choiceById);

    const session = await makeSession();
    userId = session.userId;
    const started = await session.api(`/api/exams/${SLUG}/attempt`, { method: "POST" });
    attemptId = started.attemptId;
    const submitted = await session.api(`/api/exams/${SLUG}/submit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, answers, flagged: [] }),
    });

    console.log(`--- ${label} ---`);
    console.log(`totalScore=${submitted.totalScore} maxScore=${submitted.maxScore} passingScore=${submitted.passingScore} passed=${submitted.passed}`);
    for (const section of submitted.sections) console.log(`  section ${section.code}: earned=${section.earnedScore}/${section.maxScore} correct=${section.correctCount}/${section.questionCount}`);
    console.log(`diagnostics.sections=${submitted.diagnostics?.sections?.length} diagnostics.competencies=${submitted.diagnostics?.competencies?.length}`);
  } finally {
    await cleanup(userId, attemptId);
  }
}

await run("ALL CORRECT (expect passed=true, 100/100)", (questions, keyByQuestion, choiceById) => {
  const answers = {};
  for (const q of questions) {
    const key = keyByQuestion.get(q.id);
    const choice = choiceById.get(key.correct_choice_id);
    answers[String(q.number)] = `${q.number}:${choice.label}`;
  }
  return answers;
});

await run("ALL WRONG (expect passed=false, 0/100)", (questions, keyByQuestion, choiceById) => {
  const answers = {};
  for (const q of questions) {
    const key = keyByQuestion.get(q.id);
    const correctChoice = choiceById.get(key.correct_choice_id);
    const wrongLabel = ["1", "2", "3", "4", "5"].find((label) => label !== correctChoice.label);
    answers[String(q.number)] = `${q.number}:${wrongLabel}`;
  }
  return answers;
});

console.log("DONE");
