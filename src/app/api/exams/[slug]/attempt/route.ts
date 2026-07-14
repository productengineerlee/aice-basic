import { NextResponse } from "next/server";
import { AttemptStoreError, startOrResumeAttempt } from "@/lib/attempts";
import { createClient } from "@/lib/supabase/server";

export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { slug } = await params;
    const attempt = await startOrResumeAttempt(slug, user.id);
    return NextResponse.json(attempt, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AttemptStoreError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "응시를 시작하지 못했습니다." }, { status: 500 });
  }
}