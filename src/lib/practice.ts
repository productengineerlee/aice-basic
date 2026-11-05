import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** 연속 정답 횟수별 다음 복습까지 간격(일). 오답이면 1일 뒤, 연속 3회 정답이면 졸업. */
export const GRADUATION_STREAK = 3;
const INTERVAL_AFTER_CORRECT_DAYS: Record<number, number> = { 1: 3, 2: 7 };
const DAY_MS = 86_400_000;

export type PracticeMode = "review" | "daily" | "random";

export type PracticeFeedback = {
  isCorrect: boolean;
  correctLabel: string;
  correctAnswer: string;
  explanation: string | null;
  /** counted: 이번 정답이 연속 정답에 반영됐는지(복습일 전에 미리 푼 정답은 반영하지 않음) */
  review: { wrongCount: number; correctStreak: number; graduated: boolean; nextReviewAt: string | null; counted: boolean } | null;
};

export class PracticeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** 문항 하나를 서버에서 채점하고 풀이 로그·복습 일정을 갱신한다. 자격증 시험의 공개된 객관식 문항만 허용. */
export async function gradePracticeAnswer(userId: string, questionId: string, selectedLabel: string, timeSpentMs: number | null, mode: PracticeMode): Promise<PracticeFeedback> {
  const admin = createAdminClient();

  const { data: question, error: questionError } = await admin
    .from("questions").select("id,exam_id,is_active").eq("id", questionId).maybeSingle();
  if (questionError) throw new PracticeError("문항을 불러오지 못했습니다.", 500);
  if (!question?.is_active) throw new PracticeError("풀 수 없는 문항입니다.", 404);

  const [{ data: exam }, { data: choices }, { data: key }] = await Promise.all([
    admin.from("exams").select("status,certification_id").eq("id", question.exam_id).maybeSingle(),
    admin.from("question_choices").select("id,label,content").eq("question_id", questionId),
    admin.from("answer_keys").select("correct_choice_id,explanation").eq("question_id", questionId).maybeSingle(),
  ]);
  if (exam?.status !== "published" || !exam.certification_id) throw new PracticeError("풀 수 없는 문항입니다.", 404);
  const correctChoice = choices?.find((choice) => choice.id === key?.correct_choice_id);
  if (!correctChoice) throw new PracticeError("정답 정보가 없는 문항입니다.", 422);
  if (!choices?.some((choice) => choice.label === selectedLabel)) throw new PracticeError("올바른 보기가 아닙니다.", 400);

  const isCorrect = selectedLabel === correctChoice.label;
  const answeredAt = new Date();

  const { error: logError } = await admin.from("practice_answers").insert({
    user_id: userId,
    question_id: questionId,
    selected_label: selectedLabel,
    is_correct: isCorrect,
    time_spent_ms: timeSpentMs,
    mode,
    answered_at: answeredAt.toISOString(),
  });
  if (logError) throw new PracticeError("풀이 기록을 저장하지 못했습니다.", 500);

  return {
    isCorrect,
    correctLabel: correctChoice.label,
    correctAnswer: `${correctChoice.label}. ${correctChoice.content}`,
    explanation: key?.explanation?.trim() || null,
    review: await updateReviewSchedule(admin, userId, questionId, isCorrect, answeredAt),
  };
}

async function updateReviewSchedule(admin: ReturnType<typeof createAdminClient>, userId: string, questionId: string, isCorrect: boolean, at: Date): Promise<PracticeFeedback["review"]> {
  if (!isCorrect) {
    // 틀리면 오답노트에 넣거나(틀린 횟수 +1) 졸업을 취소하고 내일 다시 복습.
    const { error } = await admin.rpc("record_wrong_answers", { p_user_id: userId, p_question_ids: [questionId], p_wrong_at: at.toISOString() });
    if (error) throw new PracticeError("오답노트를 갱신하지 못했습니다.", 500);
    return readReview(admin, userId, questionId, true);
  }

  const { data: item, error } = await admin
    .from("review_items").select("correct_streak,graduated_at,next_review_at")
    .eq("user_id", userId).eq("question_id", questionId).maybeSingle();
  if (error) throw new PracticeError("오답노트를 불러오지 못했습니다.", 500);
  if (!item) return null;
  // 졸업했거나 아직 복습일이 오지 않은 문제는 풀이 기록만 남기고 일정은 그대로 둔다(벼락치기 졸업 방지).
  if (item.graduated_at || new Date(item.next_review_at).getTime() > at.getTime()) return readReview(admin, userId, questionId, false);

  const streak = item.correct_streak + 1;
  const graduated = streak >= GRADUATION_STREAK;
  // 같은 문제를 동시에 두 번 제출해도 한 번만 반영되도록 이전 연속 정답 값이 그대로일 때만 갱신한다.
  const { error: updateError } = await admin.from("review_items").update({
    correct_streak: streak,
    graduated_at: graduated ? at.toISOString() : null,
    next_review_at: new Date(at.getTime() + (INTERVAL_AFTER_CORRECT_DAYS[streak] ?? 1) * DAY_MS).toISOString(),
  }).eq("user_id", userId).eq("question_id", questionId).eq("correct_streak", item.correct_streak).is("graduated_at", null);
  if (updateError) throw new PracticeError("오답노트를 갱신하지 못했습니다.", 500);
  return readReview(admin, userId, questionId, true);
}

async function readReview(admin: ReturnType<typeof createAdminClient>, userId: string, questionId: string, counted: boolean): Promise<PracticeFeedback["review"]> {
  const { data } = await admin
    .from("review_items").select("wrong_count,correct_streak,graduated_at,next_review_at")
    .eq("user_id", userId).eq("question_id", questionId).maybeSingle();
  return data ? { wrongCount: data.wrong_count, correctStreak: data.correct_streak, graduated: Boolean(data.graduated_at), nextReviewAt: data.graduated_at ? null : data.next_review_at, counted } : null;
}
