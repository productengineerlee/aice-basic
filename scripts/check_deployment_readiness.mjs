import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const production = process.argv.includes("--production");
const envPath = path.join(root, ".env.local");
if (!fs.existsSync(envPath)) throw new Error(".env.local 파일이 없습니다.");
const env = {};
for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const index = line.indexOf("=");
  const key = line.slice(0, index).trim();
  let value = line.slice(index + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  env[key] = value;
}
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SITE_URL"];
const missing = required.filter(key => !env[key]);
if (missing.length) throw new Error(`누락된 환경변수: ${missing.join(", ")}`);
const supabaseUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
if (supabaseUrl.protocol !== "https:" || !supabaseUrl.hostname.endsWith(".supabase.co")) throw new Error("NEXT_PUBLIC_SUPABASE_URL 형식이 올바르지 않습니다.");
if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_")) throw new Error("Publishable 키 형식이 올바르지 않습니다.");
if (!env.SUPABASE_SECRET_KEY.startsWith("sb_secret_")) throw new Error("Secret 키 형식이 올바르지 않습니다.");
const siteUrl = new URL(env.NEXT_PUBLIC_SITE_URL);
if (production && (siteUrl.protocol !== "https:" || siteUrl.hostname === "localhost")) throw new Error("운영 NEXT_PUBLIC_SITE_URL은 HTTPS 운영 도메인이어야 합니다.");
const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
if (!gitignore.includes(".env*") || !gitignore.includes(".vercel/")) throw new Error(".gitignore에서 환경변수 또는 .vercel 디렉터리가 보호되지 않습니다.");
if (!fs.existsSync(path.join(root, "vercel.json"))) throw new Error("vercel.json이 없습니다.");

const ignored = new Set(["node_modules", ".next", ".git", ".vercel", "tmp"]);
const leaks = [];
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name === ".env.local") continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (entry.isFile() && fs.statSync(full).size <= 2_000_000) {
      const content = fs.readFileSync(full, "utf8");
      if (content.includes(env.SUPABASE_SECRET_KEY)) leaks.push(path.relative(root, full));
    }
  }
}
scan(root);
if (leaks.length) throw new Error(`Secret 키가 소스 파일에 포함되어 있습니다: ${leaks.join(", ")}`);
console.log(`DEPLOY_ENV_OK=true`);
console.log(`DEPLOY_SECRET_NOT_IN_SOURCE=true`);
console.log(`DEPLOY_GITIGNORE_OK=true`);
console.log(`DEPLOY_SITE_MODE=${production ? "production" : "local"}`);