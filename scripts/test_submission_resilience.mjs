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
const cookies = [];
const ssr = createServerClient(url, publishableKey, { cookies: { getAll: () => cookies, setAll(items) { for (const item of items) { const index = cookies.findIndex(cookie => cookie.name === item.name); if (!item.value && index >= 0) cookies.splice(index, 1); else if (index >= 0) cookies[index] = { name: item.name, value: item.value }; else if (item.value) cookies.push({ name: item.name, value: item.value }); } } } });
const cookieHeader = () => cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
let userId = null;

async function json(route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { Cookie: cookieHeader(), ...(options.headers ?? {}) } });
  const data = await response.json();
  return { response, data };
}

try {
  const email = `codex-resilience-${Date.now()}@example.invalid`;
  const password = `Cdx!${crypto.randomBytes(18).toString("base64url")}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { birth_date: "1990-01-02" } });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  const signed = await ssr.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;

  const normalStart = await json("/api/exams/sample-classification-1/attempt", { method: "POST" });
  const normalId = normalStart.data.attemptId;
  const normalDraft = { attemptId: normalId, answers: { "1": "1:1", "3": "7173" }, flagged: [2] };
  await json(`/api/exams/sample-classification-1/attempt/${normalId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(normalDraft) });
  const concurrent = await Promise.all([1, 2].map(() => json("/api/exams/sample-classification-1/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(normalDraft) })));
  const replay = await json("/api/exams/sample-classification-1/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...normalDraft, answers: { "1": "1:2" } }) });
  const { count: normalAttemptCount } = await admin.from("attempts").select("id", { count: "exact", head: true }).eq("id", normalId);
  const { count: normalSectionCount } = await admin.from("section_results").select("id", { count: "exact", head: true }).eq("attempt_id", normalId);

  const expiredStart = await json("/api/exams/sample-classification-2/attempt", { method: "POST" });
  const expiredId = expiredStart.data.attemptId;
  const savedDraft = { answers: { "1": "1:1" }, flagged: [] };
  await json(`/api/exams/sample-classification-2/attempt/${expiredId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(savedDraft) });
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  const expiredStartedAt = new Date(Date.now() - 120_000).toISOString();
  const expiredUpdate = await admin.from("attempts").update({ status: "expired", started_at: expiredStartedAt, expires_at: expiredAt }).eq("id", expiredId);
  if (expiredUpdate.error) throw expiredUpdate.error;
  const expiredSubmit = await json("/api/exams/sample-classification-2/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attemptId: expiredId, answers: { "1": "1:2" }, flagged: [] }) });
  const expiredQuestion = expiredSubmit.data.questions?.find(question => question.number === 1);

  const malformed = await fetch(`${base}/api/exams/sample-classification-1/submit`, { method: "POST", headers: { Cookie: cookieHeader(), "Content-Type": "application/json" }, body: "{" });
  const malformedBody = await malformed.json();
  const notFound = await fetch(`${base}/this-page-does-not-exist`);
  const notFoundHtml = await notFound.text();

  console.log(`CONCURRENT_SUBMIT_OK=${concurrent.every(item => item.response.status === 200) && concurrent[0].data.id === normalId && concurrent[1].data.id === normalId}`);
  console.log(`DUPLICATE_REPLAY_OK=${replay.response.status === 200 && replay.response.headers.get("x-submission-replayed") === "true" && replay.data.totalScore === concurrent[0].data.totalScore}`);
  console.log(`SINGLE_ATTEMPT_ROW_OK=${normalAttemptCount === 1}`);
  console.log(`SECTION_RESULT_UPSERT_OK=${normalSectionCount === 4}`);
  console.log(`EXPIRED_STORED_ANSWER_OK=${expiredSubmit.response.status === 200 && expiredQuestion?.userAnswer === "1:1"}`);
  console.log(`REQUEST_ID_ERROR_OK=${malformed.status === 400 && Boolean(malformed.headers.get("x-request-id")) && malformedBody.requestId === malformed.headers.get("x-request-id")}`);
  console.log(`CUSTOM_404_OK=${notFound.status === 404 && notFoundHtml.includes("요청한 페이지를 찾을 수 없습니다")}`);
} finally {
  let removed = true;
  if (userId) { const result = await admin.auth.admin.deleteUser(userId); removed = !result.error; }
  console.log(`RESILIENCE_TEST_DATA_REMOVED=${removed}`);
}
