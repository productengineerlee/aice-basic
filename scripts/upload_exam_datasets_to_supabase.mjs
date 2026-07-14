import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const root = process.cwd();
loadEnv(path.join(root, ".env.local"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase server environment variables are missing");
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const bucketId = "exam-datasets";

const bucketResult = await supabase.storage.getBucket(bucketId);
if (bucketResult.error) throw new Error(`Storage bucket check failed: ${bucketResult.error.message}`);
if (bucketResult.data.public) {
  const updated = await supabase.storage.updateBucket(bucketId, { public: false, fileSizeLimit: 10 * 1024 * 1024 });
  if (updated.error) throw new Error(`Storage bucket privacy update failed: ${updated.error.message}`);
}

const [{ data: exams, error: examError }, { data: assets, error: assetError }] = await Promise.all([
  supabase.from("exams").select("id,slug").eq("status", "published"),
  supabase.from("exam_assets").select("exam_id,title,bucket_id,object_path").eq("asset_type", "dataset"),
]);
if (examError || assetError || !exams || !assets) throw new Error("Exam asset metadata could not be loaded");
const examById = new Map(exams.map((exam) => [exam.id, exam]));
if (assets.length !== 6) throw new Error(`Expected 6 dataset assets, found ${assets.length}`);

let verified = 0;
for (const asset of assets) {
  const exam = examById.get(asset.exam_id);
  if (!exam) throw new Error(`Exam missing for asset ${asset.object_path}`);
  if (asset.bucket_id !== bucketId || !asset.object_path.startsWith(`${exam.slug}/`) || asset.object_path.includes("..")) {
    throw new Error(`Unsafe asset path: ${asset.object_path}`);
  }
  const localPath = path.join(root, "data", "exam-datasets", exam.slug, asset.title);
  if (!fs.existsSync(localPath)) throw new Error(`Local dataset missing: ${exam.slug}/${asset.title}`);
  const local = fs.readFileSync(localPath);
  const uploaded = await supabase.storage.from(bucketId).upload(asset.object_path, local, {
    contentType: "text/csv; charset=utf-8",
    cacheControl: "3600",
    upsert: true,
  });
  if (uploaded.error) throw new Error(`Upload failed for ${asset.object_path}: ${uploaded.error.message}`);
  const downloaded = await supabase.storage.from(bucketId).download(asset.object_path);
  if (downloaded.error || !downloaded.data) throw new Error(`Verification download failed for ${asset.object_path}`);
  const remote = Buffer.from(await downloaded.data.arrayBuffer());
  const hashMatches = local.length === remote.length && sha256(local) === sha256(remote);
  if (!hashMatches) throw new Error(`Hash mismatch for ${asset.object_path}`);
  verified += 1;
  console.log(`UPLOADED ${asset.object_path}: ${local.length} bytes, SHA256_OK=true`);
}

const finalBucket = await supabase.storage.getBucket(bucketId);
if (finalBucket.error || finalBucket.data.public) throw new Error("Dataset bucket is not private");
console.log(`UPLOAD_COMPLETE files=${verified}, bucket_private=true`);