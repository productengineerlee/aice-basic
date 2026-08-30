import { NextResponse } from "next/server";
import { AttemptStoreError, saveAttemptDraft, type DraftInput } from "@/lib/attempts";
import { createClient } from "@/lib/supabase/server";

function parseDraft(value: unknown): DraftInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as { answers?: unknown; flagged?: unknown };
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) return null;
  const entries = Object.entries(body.answers as Record<string, unknown>);
  if (entries.length > 200 || entries.some(([key, answer]) => !/^\d+$/.test(key) || typeof answer !== "string" || answer.length > 500)) return null;
  if (!Array.isArray(body.flagged) || body.flagged.length > 200 || body.flagged.some((number) => !Number.isInteger(number) || Number(number) < 1 || Number(number) > 500)) return null;
  return { answers: Object.fromEntries(entries) as Record<string, string>, flagged: [...new Set(body.flagged as number[])] };
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string; attemptId: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const body = parseDraft(await request.json());
    if (!body) return NextResponse.json({ error: "올바른 답안 데이터가 아닙니다." }, { status: 400 });
    const { slug, attemptId } = await params;
    const saved = await saveAttemptDraft(slug, attemptId, user.id, body);
    return NextResponse.json(saved, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AttemptStoreError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "답안을 저장하지 못했습니다." }, { status: 500 });
  }
}