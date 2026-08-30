import { NextResponse } from "next/server";
import { AttemptStoreError, getExamContext, loadAttemptResult, persistGradingResult, prepareSubmission, type DraftInput } from "@/lib/attempts";
import { gradeExam } from "@/lib/grading";
import { createClient } from "@/lib/supabase/server";

function parseBody(value: unknown): (DraftInput & { attemptId: string }) | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as { attemptId?: unknown; answers?: unknown; flagged?: unknown };
  if (typeof body.attemptId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.attemptId)) return null;
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) return null;
  const entries = Object.entries(body.answers as Record<string, unknown>);
  if (entries.length > 200 || entries.some(([key, answer]) => !/^\d+$/.test(key) || typeof answer !== "string" || answer.length > 500)) return null;
  const flagged = body.flagged ?? [];
  if (!Array.isArray(flagged) || flagged.length > 200 || flagged.some((number) => !Number.isInteger(number) || Number(number) < 1 || Number(number) > 500)) return null;
  return { attemptId: body.attemptId, answers: Object.fromEntries(entries) as Record<string, string>, flagged: [...new Set(flagged as number[])] };
}

function response(data: unknown, requestId: string, status = 200, replayed?: boolean) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      ...(replayed === undefined ? {} : { "X-Submission-Replayed": String(replayed) }),
    },
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const requestId = crypto.randomUUID();
  let retryContext: { slug: string; userId: string; attemptId: string } | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return response({ error: "로그인이 필요합니다.", requestId }, requestId, 401);
    let raw: unknown;
    try { raw = await request.json(); }
    catch { return response({ error: "요청 데이터를 읽을 수 없습니다.", requestId }, requestId, 400); }
    const body = parseBody(raw);
    if (!body) return response({ error: "올바른 답안 데이터가 아닙니다.", requestId }, requestId, 400);
    const { slug } = await params;
    retryContext = { slug, userId: user.id, attemptId: body.attemptId };

    const context = await getExamContext(slug);

    const existing = await loadAttemptResult(context, user.id, body.attemptId);
    if (existing) return response(existing, requestId, 200, true);

    const prepared = await prepareSubmission(context, body.attemptId, user.id, body);
    const graded = await gradeExam(context, prepared.answers);
    const result = await persistGradingResult(context, body.attemptId, user.id, prepared, graded);
    return response(result, requestId, 200, false);
  } catch (error) {
    if (error instanceof AttemptStoreError && error.status === 409 && retryContext) {
      try {
        const retryContextData = await getExamContext(retryContext.slug);
        const existing = await loadAttemptResult(retryContextData, retryContext.userId, retryContext.attemptId);
        if (existing) return response(existing, requestId, 200, true);
      } catch (replayError) {
        console.error(`[submit-replay:${requestId}]`, replayError);
      }
    }
    if (error instanceof AttemptStoreError) return response({ error: error.message, requestId }, requestId, error.status);
    console.error(`[submit:${requestId}]`, error);
    return response({ error: "채점 중 오류가 발생했습니다.", requestId }, requestId, 500);
  }
}