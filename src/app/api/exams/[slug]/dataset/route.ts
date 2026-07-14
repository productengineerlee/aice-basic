import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  try {
    const { slug } = await params;
    const admin = createAdminClient();
    const { data: exam, error: examError } = await admin
      .from("exams")
      .select("id,slug")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (examError) throw examError;
    if (!exam) return NextResponse.json({ error: "시험을 찾을 수 없습니다." }, { status: 404 });

    const { data: asset, error: assetError } = await admin
      .from("exam_assets")
      .select("title,bucket_id,object_path")
      .eq("exam_id", exam.id)
      .eq("asset_type", "dataset")
      .eq("is_downloadable", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (assetError) throw assetError;
    if (!asset) return NextResponse.json({ error: "실습 데이터가 없습니다." }, { status: 404 });

    const expectedPrefix = `${exam.slug}/`;
    const safePath = asset.bucket_id === "exam-datasets"
      && asset.object_path.startsWith(expectedPrefix)
      && !asset.object_path.includes("..")
      && !asset.object_path.includes("\\");
    if (!safePath) return NextResponse.json({ error: "허용되지 않은 파일 경로입니다." }, { status: 403 });

    const { data: signed, error: signedError } = await admin.storage
      .from(asset.bucket_id)
      .createSignedUrl(asset.object_path, 60, { download: asset.title });
    if (signedError || !signed?.signedUrl) throw signedError ?? new Error("Signed URL missing");

    const response = NextResponse.redirect(signed.signedUrl, 307);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return NextResponse.json({ error: "실습 데이터 다운로드 링크를 만들지 못했습니다." }, { status: 500 });
  }
}