import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

for (const rawLine of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const separator = line.indexOf("=");
  const key = line.slice(0, separator).trim();
  let value = line.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!process.env[key]) process.env[key] = value;
}

const email = String(process.argv[2] ?? "").trim().toLowerCase();
const role = String(process.argv[3] ?? "admin").trim();
if (!email || !email.includes("@") || !["admin", "student"].includes(role)) {
  throw new Error("사용법: node scripts/set_admin_role.mjs 이메일 [admin|student]");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase 서버 환경변수가 없습니다.");
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

let matched = null;
for (let page = 1; page <= 100 && !matched; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  matched = data.users.find(user => user.email?.toLowerCase() === email) ?? null;
  if (data.users.length < 1000) break;
}
if (!matched) throw new Error("해당 이메일의 가입 사용자를 찾을 수 없습니다.");
const { error } = await supabase.from("profiles").update({ role }).eq("id", matched.id);
if (error) throw error;
console.log(`${email} 계정의 역할을 ${role}(으)로 변경했습니다.`);
