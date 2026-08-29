import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadEnv(filePath) {
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

const root = process.cwd();
loadEnv(path.join(root, ".env.local"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase server environment variables are missing");
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const bucketId = "theory-images";
const { data: existing } = await supabase.storage.getBucket(bucketId);

if (!existing) {
  const { error } = await supabase.storage.createBucket(bucketId, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  });
  if (error) throw new Error(`Bucket creation failed: ${error.message}`);
  console.log(`Created public bucket "${bucketId}".`);
} else if (!existing.public) {
  const { error } = await supabase.storage.updateBucket(bucketId, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  });
  if (error) throw new Error(`Bucket update failed: ${error.message}`);
  console.log(`Updated bucket "${bucketId}" to public.`);
} else {
  console.log(`Bucket "${bucketId}" already exists and is public.`);
}
