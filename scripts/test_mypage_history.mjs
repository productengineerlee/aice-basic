import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

for (const rawLine of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
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
if (!url || !publishableKey || !secretKey) throw new Error("Supabase 환경변수가 없습니다.");
const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const base = "http://127.0.0.1:3000";
const userIds = [];

async function createUser(label) {
  const email = `codex-mypage-${label}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}@example.invalid`;
  const password = `Cdx!${crypto.randomBytes(18).toString("base64url")}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { birth_date: "1990-01-02" } });
  if (error) throw error;
  userIds.push(data.user.id);
  return { id: data.user.id, email, password };
}
async function cookieFor(user) {
  const cookies = [];
  const client = createServerClient(url, publishableKey, { cookies: { getAll: () => cookies, setAll(items) { for (const item of items) { const index = cookies.findIndex(cookie => cookie.name === item.name); if (!item.value && index >= 0) cookies.splice(index, 1); else if (index >= 0) cookies[index] = { name: item.name, value: item.value }; else if (item.value) cookies.push({ name: item.name, value: item.value }); } } } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
}

try {
  const { data: exam, error: examError } = await admin.from("exams").select("id,slug,total_score,passing_score").eq("status", "published").limit(1).single();
  if (examError) throw examError;
  const { data: question, error: questionError } = await admin.from("questions").select("id,score,competency_tags").eq("exam_id", exam.id).eq("is_active", true).limit(1).single();
  if (questionError) throw questionError;
  const owner = await createUser("owner");
  const stranger = await createUser("stranger");
  const now = Date.now();
  const scores = [51.11, 55, 60, 65, 70, 75, 80, 85, 90, 95, 99];
  const rows = scores.map((score, index) => {
    const started = new Date(now - (scores.length - index) * 86_400_000);
    const graded = new Date(started.getTime() + 30 * 60_000).toISOString();
    return { exam_id: exam.id, user_id: owner.id, status: "graded", started_at: started.toISOString(), expires_at: new Date(started.getTime() + 90 * 60_000).toISOString(), submitted_at: graded, graded_at: graded, total_score: score, correct_count: index + 1, answered_count: index + 2, passed: score >= Number(exam.passing_score) };
  });
  const { data: attempts, error: attemptError } = await admin.from("attempts").insert(rows).select("id,started_at");
  if (attemptError) throw attemptError;
  const latest = [...attempts].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 2);
  const { error: answerError } = await admin.from("attempt_answers").insert(latest.map((attempt, index) => ({ attempt_id: attempt.id, question_id: question.id, answer_text: "mypage-test", is_correct: index === 0, awarded_score: index === 0 ? Number(question.score) : 0, graded_at: new Date().toISOString() })));
  if (answerError) throw answerError;
  const strangerStarted = new Date(now - 3_600_000).toISOString();
  const { error: strangerError } = await admin.from("attempts").insert({ exam_id: exam.id, user_id: stranger.id, status: "graded", started_at: strangerStarted, expires_at: new Date(now + 3_600_000).toISOString(), submitted_at: strangerStarted, graded_at: strangerStarted, total_score: 77.77, correct_count: 7, answered_count: 7, passed: false });
  if (strangerError) throw strangerError;

  const cookie = await cookieFor(owner);
  const [anonymous, firstPage, secondPage, filtered] = await Promise.all([
    fetch(`${base}/mypage`, { redirect: "manual" }),
    fetch(`${base}/mypage`, { headers: { Cookie: cookie } }),
    fetch(`${base}/mypage?page=2`, { headers: { Cookie: cookie } }),
    fetch(`${base}/mypage?exam=${exam.id}`, { headers: { Cookie: cookie } }),
  ]);
  const [firstHtml, secondHtml, filteredHtml] = await Promise.all([firstPage.text(), secondPage.text(), filtered.text()]);
  console.log(`MYPAGE_ANON_REDIRECT=${[307, 308].includes(anonymous.status) && anonymous.headers.get("location")?.startsWith("/auth/login")}`);
  console.log(`MYPAGE_FIRST_PAGE_OK=${firstPage.status === 200 && firstHtml.includes("최근 점수 변화") && firstHtml.includes("우선 보강 역량") && firstHtml.includes("전체 응시 이력")}`);
  console.log(`MYPAGE_PAGINATION_OK=${secondPage.status === 200 && secondHtml.includes("51.11") && !firstHtml.includes("51.11")}`);
  console.log(`MYPAGE_FILTER_OK=${filtered.status === 200 && filteredHtml.includes(exam.id)}`);
  console.log(`MYPAGE_COMPETENCY_OK=${question.competency_tags.some(tag => firstHtml.includes(tag))}`);
  console.log(`MYPAGE_USER_ISOLATION_OK=${!firstHtml.includes("77.77") && !secondHtml.includes("77.77")}`);
} finally {
  let removed = true;
  for (const id of userIds) { const result = await admin.auth.admin.deleteUser(id); removed = removed && !result.error; }
  console.log(`MYPAGE_TEST_DATA_REMOVED=${removed}`);
}
