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
if (!url || !publishableKey || !secretKey) throw new Error("Missing Supabase environment variables");

const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const cookies = [];
const ssr = createServerClient(url, publishableKey, {
  cookies: {
    getAll: () => cookies,
    setAll(items) {
      for (const item of items) {
        const index = cookies.findIndex((cookie) => cookie.name === item.name);
        if (!item.value) {
          if (index >= 0) cookies.splice(index, 1);
        } else if (index >= 0) cookies[index] = { name: item.name, value: item.value };
        else cookies.push({ name: item.name, value: item.value });
      }
    },
  },
});

const base = "http://127.0.0.1:3000";
let userId = null;
let attemptId = null;
let cleanupOk = false;
let diagnosticReadOk = false;
let diagnosticWriteBlocked = false;
const diagnosticProbeId = crypto.randomUUID();

function cookieHeader() {
  return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}
async function api(route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { Cookie: cookieHeader(), ...(options.headers ?? {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${route}:${response.status}:${data.error ?? "unknown"}`);
  return data;
}

try {
  const stamp = Date.now();
  const email = `codex-attempt-${stamp}@example.invalid`;
  const password = `Cdx!${crypto.randomBytes(18).toString("base64url")}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { birth_date: "1990-01-02", terms_version: "2026-07-12", privacy_version: "2026-07-12" },
  });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  const signed = await ssr.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session || cookies.length === 0) throw signed.error ?? new Error("SSR cookie missing");

  const diagnosticRead = await ssr.from("diagnostic_rules").select("id", { count: "exact", head: true });
  diagnosticReadOk = !diagnosticRead.error && Number(diagnosticRead.count) >= 84;
  const diagnosticWrite = await ssr.from("diagnostic_rules").insert({
    id: diagnosticProbeId, section_code: "__rls_test__", competency_tag: null,
    min_percentage: 0, max_percentage: 100, level: "foundation",
    comment: "RLS test", recommendation: "RLS test", priority: 0, is_active: true,
  });
  diagnosticWriteBlocked = Boolean(diagnosticWrite.error);

  const datasetRedirect = await fetch(`${base}/api/exams/sample-classification-1/dataset`, { headers: { Cookie: cookieHeader() }, redirect: "manual" });
  const signedLocation = datasetRedirect.headers.get("location");
  if (!signedLocation) throw new Error("Signed dataset location missing");
  const token = new URL(signedLocation).searchParams.get("token");
  const tokenPayload = token ? JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) : null;
  const signedTtl = tokenPayload?.exp ? tokenPayload.exp - Math.floor(Date.now() / 1000) : 0;
  const datasetResponse = await fetch(signedLocation);
  const datasetBytes = Buffer.from(await datasetResponse.arrayBuffer());
  const localDataset = fs.readFileSync(path.join(process.cwd(), "data", "exam-datasets", "sample-classification-1", "moviegenre.csv"));
  const publicObjectResponse = await fetch(`${url}/storage/v1/object/public/exam-datasets/sample-classification-1/moviegenre.csv`);
  console.log(`DATASET_DOWNLOAD_OK=${datasetRedirect.status === 307 && datasetResponse.status === 200 && signedLocation.includes("/storage/v1/object/sign/")}`);
  console.log(`SIGNED_URL_TTL_SECONDS=${signedTtl}`);
  console.log(`SIGNED_URL_TTL_OK=${signedTtl > 0 && signedTtl <= 70}`);
  console.log(`DATASET_HASH_OK=${datasetBytes.length === localDataset.length && crypto.createHash("sha256").update(datasetBytes).digest("hex") === crypto.createHash("sha256").update(localDataset).digest("hex")}`);
  console.log(`PUBLIC_STORAGE_BLOCKED=${!publicObjectResponse.ok}`);

  const takeResponse = await fetch(`${base}/exams/sample-classification-1/take`, { headers: { Cookie: cookieHeader() } });
  const takeHtml = await takeResponse.text();
  console.log(`TAKE_PAGE_OK=${takeResponse.status === 200}`);
  console.log(`TAKE_PAGE_ANSWER_LEAK=${takeHtml.includes("7173") || takeHtml.includes("본 과제는 호러장르 선호여부를 예측")}`);

  const started = await api("/api/exams/sample-classification-1/attempt", { method: "POST" });
  attemptId = started.attemptId;
  const draft = { answers: { "1": "1:1", "3": "7173" }, flagged: [2] };
  const saved = await api(`/api/exams/sample-classification-1/attempt/${attemptId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  const resumed = await api("/api/exams/sample-classification-1/attempt", { method: "POST" });
  const submitted = await api("/api/exams/sample-classification-1/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId, ...draft }),
  });
  const loaded = await api(`/api/exams/sample-classification-1/result?attemptId=${attemptId}`);

  const { data: attempt } = await admin.from("attempts").select("status,answered_count,total_score").eq("id", attemptId).single();
  const { count: answerCount } = await admin.from("attempt_answers").select("*", { count: "exact", head: true }).eq("attempt_id", attemptId);
  const { count: sectionCount } = await admin.from("section_results").select("*", { count: "exact", head: true }).eq("attempt_id", attemptId);

  console.log(`START_OK=${Boolean(attemptId)}`);
  console.log(`SAVE_OK=${Boolean(saved.savedAt)}`);
  console.log(`RESUME_SAME_ATTEMPT=${resumed.attemptId === attemptId}`);
  console.log(`RESUME_ANSWERS_OK=${resumed.answers["1"] === "1:1" && resumed.answers["3"] === "7173"}`);
  console.log(`RESUME_FLAG_OK=${resumed.flagged.includes(2)}`);
  console.log(`SUBMIT_RESULT_OK=${submitted.id === attemptId && submitted.totalScore === 11.33}`);
  console.log(`RESULT_RELOAD_OK=${loaded.id === attemptId && loaded.totalScore === submitted.totalScore}`);
  console.log(`DIAGNOSTIC_SECTIONS_OK=${submitted.diagnostics?.sections?.length === 4 && loaded.diagnostics?.sections?.length === 4}`);
  console.log(`DIAGNOSTIC_COMPETENCIES_OK=${submitted.diagnostics?.competencies?.length > 0 && loaded.diagnostics?.competencies?.length === submitted.diagnostics?.competencies?.length}`);
  console.log(`DIAGNOSTIC_COMMENTS_OK=${submitted.diagnostics?.sections?.every(item => item.ruleId && item.comment && item.recommendation) && submitted.diagnostics?.competencies?.every(item => item.ruleId && item.comment && item.recommendation)}`);
  console.log(`DIAGNOSTIC_RLS_READ_OK=${diagnosticReadOk}`);
  console.log(`DIAGNOSTIC_RLS_WRITE_BLOCKED=${diagnosticWriteBlocked}`);
  console.log(`ATTEMPT_STATUS=${attempt?.status}`);
  console.log(`ANSWER_ROWS=${answerCount}`);
  console.log(`SECTION_RESULTS=${sectionCount}`);
} finally {
  await admin.from("diagnostic_rules").delete().eq("id", diagnosticProbeId);
  if (userId) {
    const removed = await admin.auth.admin.deleteUser(userId);
    cleanupOk = !removed.error;
  }
  if (attemptId) {
    const { count } = await admin.from("attempts").select("*", { count: "exact", head: true }).eq("id", attemptId);
    cleanupOk = cleanupOk && count === 0;
  }
  console.log(`TEST_DATA_REMOVED=${cleanupOk}`);
}