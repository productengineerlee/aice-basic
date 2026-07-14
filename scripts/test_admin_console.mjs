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

async function sessionFor(email, password) {
  const cookies = [];
  const client = createServerClient(url, publishableKey, { cookies: { getAll: () => cookies, setAll(items) { for (const item of items) { const index = cookies.findIndex(cookie => cookie.name === item.name); if (!item.value && index >= 0) cookies.splice(index, 1); else if (index >= 0) cookies[index] = { name: item.name, value: item.value }; else if (item.value) cookies.push({ name: item.name, value: item.value }); } } } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
}

async function createUser(role) {
  const email = `codex-admin-test-${role}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}@example.invalid`;
  const password = `Cdx!${crypto.randomBytes(18).toString("base64url")}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { birth_date: "1990-01-02" } });
  if (error) throw error;
  userIds.push(data.user.id);
  if (role === "admin") {
    const updated = await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
    if (updated.error) throw updated.error;
  }
  return { email, password };
}

try {
  const [examResult, questionResult] = await Promise.all([
    admin.from("exams").select("id").limit(1).maybeSingle(),
    admin.from("questions").select("id").limit(1).maybeSingle(),
  ]);
  if (examResult.error || questionResult.error || !examResult.data || !questionResult.data) throw examResult.error ?? questionResult.error ?? new Error("시험 또는 문항 데이터가 없습니다.");
  const exam = examResult.data;
  const question = questionResult.data;
  const { data: answerKey } = await admin.from("answer_keys").select("explanation").eq("question_id", question.id).single();
  const anonymous = await fetch(`${base}/admin`, { redirect: "manual" });
  const student = await createUser("student");
  const studentCookie = await sessionFor(student.email, student.password);
  const studentAdmin = await fetch(`${base}/admin`, { headers: { Cookie: studentCookie }, redirect: "manual" });
  const studentQuestion = await fetch(`${base}/admin/questions/${question.id}`, { headers: { Cookie: studentCookie }, redirect: "manual" });
  const administrator = await createUser("admin");
  const adminCookie = await sessionFor(administrator.email, administrator.password);
  const pages = await Promise.all([
    fetch(`${base}/admin`, { headers: { Cookie: adminCookie } }),
    fetch(`${base}/admin/exams`, { headers: { Cookie: adminCookie } }),
    fetch(`${base}/admin/exams/${exam.id}`, { headers: { Cookie: adminCookie } }),
    fetch(`${base}/admin/questions/${question.id}`, { headers: { Cookie: adminCookie } }),
    fetch(`${base}/admin/diagnostics`, { headers: { Cookie: adminCookie } }),
  ]);
  const questionHtml = await pages[3].text();
  const explanationMarker = String(answerKey?.explanation ?? "").slice(0, 12);
  console.log(`ANON_ADMIN_REDIRECT=${[307, 308].includes(anonymous.status) && anonymous.headers.get("location")?.startsWith("/auth/login")}`);
  console.log(`STUDENT_ADMIN_BLOCKED=${[307, 308].includes(studentAdmin.status) && studentAdmin.headers.get("location") === "/dashboard"}`);
  console.log(`STUDENT_ANSWER_PAGE_BLOCKED=${[307, 308].includes(studentQuestion.status) && studentQuestion.headers.get("location") === "/dashboard"}`);
  console.log(`ADMIN_PAGES_OK=${pages.every(response => response.status === 200)}`);
  console.log(`ADMIN_ANSWER_VISIBLE=${Boolean(explanationMarker) && questionHtml.includes(explanationMarker)}`);
  console.log(`ADMIN_DIAGNOSTIC_RULES_VISIBLE=${(await pages[4].text()).includes("진단 규칙 관리")}`);
} finally {
  let removed = true;
  for (const id of userIds) { const result = await admin.auth.admin.deleteUser(id); removed = removed && !result.error; }
  console.log(`ADMIN_TEST_USERS_REMOVED=${removed}`);
}
