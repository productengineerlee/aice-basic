import { NextResponse } from "next/server";
import { AttemptStoreError, getExamContext, loadAttemptResult } from "@/lib/attempts";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { slug } = await params;
    const requestedId = new URL(request.url).searchParams.get("attemptId") ?? undefined;
    if (requestedId && !/^[0-9a-f-]{36}$/i.test(requestedId)) return NextResponse.json({ error: "응시 ID 형식이 올바르지 않습니다." }, { status: 400 });
    const context = await getExamContext(slug);
    const result = await loadAttemptResult(context, user.id, requestedId);
    if (!result) return NextResponse.json({ error: "채점 결과를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AttemptStoreError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "채점 결과를 불러오지 못했습니다." }, { status: 500 });
  }
}