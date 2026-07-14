import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateDiagnostics } from "@/lib/diagnostics";
import type { GradingResult, SubmittedAnswers } from "@/lib/grading";
import type { AttemptStatus, Database } from "@/types/database";

type ExamRow = Database["public"]["Tables"]["exams"]["Row"];
type SectionRow = Database["public"]["Tables"]["exam_sections"]["Row"];
type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type ChoiceRow = Database["public"]["Tables"]["question_choices"]["Row"];
type AttemptRow = Database["public"]["Tables"]["attempts"]["Row"];
type AttemptAnswerRow = Database["public"]["Tables"]["attempt_answers"]["Row"];
type AnswerKeyRow = Database["public"]["Tables"]["answer_keys"]["Row"];

type AdminClient = ReturnType<typeof createAdminClient>;
type Context = {
  exam: ExamRow;
  sections: SectionRow[];
  questions: QuestionRow[];
  choices: ChoiceRow[];
  questionByNumber: Map<number, QuestionRow>;
  questionById: Map<string, QuestionRow>;
  choiceById: Map<string, ChoiceRow>;
  choiceByQuestionLabel: Map<string, ChoiceRow>;
};

export type DraftInput = { answers: SubmittedAnswers; flagged: number[] };
export type AttemptDraft = {
  attemptId: string;
  startedAt: string;
  expiresAt: string;
  updatedAt: string;
  answers: SubmittedAnswers;
  flagged: number[];
};

export class AttemptStoreError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function fail(message: string, status = 500): never {
  throw new AttemptStoreError(message, status);
}

async function getContext(admin: AdminClient, slug: string): Promise<Context> {
  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (examError) fail("시험 정보를 불러오지 못했습니다.");
  if (!exam) fail("시험을 찾을 수 없습니다.", 404);

  const [{ data: sections, error: sectionError }, { data: questions, error: questionError }] = await Promise.all([
    admin.from("exam_sections").select("*").eq("exam_id", exam.id).order("sort_order"),
    admin.from("questions").select("*").eq("exam_id", exam.id).eq("is_active", true).order("number"),
  ]);
  if (sectionError || questionError || !sections || !questions) fail("시험 문항을 불러오지 못했습니다.");

  const questionIds = questions.map((question) => question.id);
  const { data: choices, error: choiceError } = questionIds.length
    ? await admin.from("question_choices").select("*").in("question_id", questionIds).order("sort_order")
    : { data: [] as ChoiceRow[], error: null };
  if (choiceError || !choices) fail("문항 보기를 불러오지 못했습니다.");

  return {
    exam,
    sections,
    questions,
    choices,
    questionByNumber: new Map(questions.map((question) => [question.number, question])),
    questionById: new Map(questions.map((question) => [question.id, question])),
    choiceById: new Map(choices.map((choice) => [choice.id, choice])),
    choiceByQuestionLabel: new Map(choices.map((choice) => [`${choice.question_id}:${choice.label}`, choice])),
  };
}

async function getAttempt(
  admin: AdminClient,
  context: Context,
  attemptId: string,
  userId: string,
  allowExpired = false,
): Promise<AttemptRow> {
  const { data: attempt, error } = await admin
    .from("attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .eq("exam_id", context.exam.id)
    .maybeSingle();
  if (error) fail("응시 정보를 확인하지 못했습니다.");
  if (!attempt) fail("응시 정보를 찾을 수 없습니다.", 404);
  const allowedStatuses: AttemptStatus[] = allowExpired ? ["in_progress", "expired"] : ["in_progress"];
  if (!allowedStatuses.includes(attempt.status)) fail("이미 종료된 응시입니다.", 409);
  if (!allowExpired && new Date(attempt.expires_at).getTime() <= Date.now()) {
    await admin.from("attempts").update({ status: "expired" }).eq("id", attempt.id);
    fail("시험 시간이 종료되었습니다.", 409);
  }
  return attempt;
}

export async function prepareSubmission(
  slug: string,
  attemptId: string,
  userId: string,
  input: DraftInput,
): Promise<DraftInput> {
  const admin = createAdminClient();
  const context = await getContext(admin, slug);
  const attempt = await getAttempt(admin, context, attemptId, userId, true);
  const graceDeadline = new Date(attempt.expires_at).getTime() + 30_000;
  if (Date.now() <= graceDeadline) return input;

  const { data: rows, error } = await admin.from("attempt_answers").select("*").eq("attempt_id", attemptId);
  if (error || !rows) fail("만료 시점의 저장 답안을 불러오지 못했습니다.");
  return rowsToDraft(context, rows);
}

function rowsToDraft(context: Context, rows: AttemptAnswerRow[]) {
  const answers: SubmittedAnswers = {};
  const flagged: number[] = [];
  for (const row of rows) {
    const question = context.questionById.get(row.question_id);
    if (!question) continue;
    if (row.selected_choice_id) {
      const choice = context.choiceById.get(row.selected_choice_id);
      if (choice) answers[String(question.number)] = `${question.number}:${choice.label}`;
    } else if (row.answer_text) {
      answers[String(question.number)] = row.answer_text;
    }
    if (row.is_flagged) flagged.push(question.number);
  }
  return { answers, flagged };
}

function buildAnswerRows(
  context: Context,
  attemptId: string,
  input: DraftInput,
  graded?: Map<number, { isCorrect: boolean; awardedScore: number }>,
) {
  const flagged = new Set(input.flagged);
  const now = new Date().toISOString();
  const rows: Database["public"]["Tables"]["attempt_answers"]["Insert"][] = [];

  for (const question of context.questions) {
    const value = String(input.answers[String(question.number)] ?? "");
    const hasAnswer = value.trim().length > 0;
    const isFlagged = flagged.has(question.number);
    if (!hasAnswer && !isFlagged) continue;

    let selectedChoiceId: string | null = null;
    let answerText: string | null = null;
    if (question.type === "single_choice" && hasAnswer) {
      const prefix = `${question.number}:`;
      if (!value.startsWith(prefix)) fail(`문항 ${question.number}의 답안 형식이 올바르지 않습니다.`, 400);
      const label = value.slice(prefix.length);
      const choice = context.choiceByQuestionLabel.get(`${question.id}:${label}`);
      if (!choice) fail(`문항 ${question.number}의 보기를 찾을 수 없습니다.`, 400);
      selectedChoiceId = choice.id;
    } else {
      answerText = value;
    }

    const grade = graded?.get(question.number);
    rows.push({
      attempt_id: attemptId,
      question_id: question.id,
      selected_choice_id: selectedChoiceId,
      answer_text: answerText,
      is_flagged: isFlagged,
      is_correct: grade?.isCorrect ?? null,
      awarded_score: grade?.awardedScore ?? null,
      answered_at: now,
      graded_at: grade ? now : null,
    });
  }
  return rows;
}

async function syncAnswerRows(admin: AdminClient, attemptId: string, rows: Database["public"]["Tables"]["attempt_answers"]["Insert"][]) {
  const { data: existing, error: existingError } = await admin
    .from("attempt_answers")
    .select("question_id")
    .eq("attempt_id", attemptId);
  if (existingError) fail("기존 답안을 확인하지 못했습니다.");

  const active = new Set(rows.map((row) => String(row.question_id)));
  const stale = (existing ?? []).map((row) => row.question_id).filter((id) => !active.has(id));
  if (stale.length) {
    const { error } = await admin.from("attempt_answers").delete().eq("attempt_id", attemptId).in("question_id", stale);
    if (error) fail("삭제된 답안을 반영하지 못했습니다.");
  }
  if (rows.length) {
    const { error } = await admin.from("attempt_answers").upsert(rows, { onConflict: "attempt_id,question_id" });
    if (error) fail("답안을 저장하지 못했습니다.");
  }
}

export async function startOrResumeAttempt(slug: string, userId: string): Promise<AttemptDraft> {
  const admin = createAdminClient();
  const context = await getContext(admin, slug);
  const now = new Date();
  const nowIso = now.toISOString();

  await admin
    .from("attempts")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .eq("exam_id", context.exam.id)
    .eq("status", "in_progress")
    .lte("expires_at", nowIso);

  let { data: attempt, error } = await admin
    .from("attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("exam_id", context.exam.id)
    .eq("status", "in_progress")
    .gt("expires_at", nowIso)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("응시 정보를 불러오지 못했습니다.");

  if (!attempt) {
    const expiresAt = new Date(now.getTime() + context.exam.duration_minutes * 60_000).toISOString();
    const inserted = await admin
      .from("attempts")
      .insert({ exam_id: context.exam.id, user_id: userId, status: "in_progress", expires_at: expiresAt })
      .select("*")
      .single();
    if (inserted.error?.code === "23505") {
      const retried = await admin
        .from("attempts")
        .select("*")
        .eq("user_id", userId)
        .eq("exam_id", context.exam.id)
        .eq("status", "in_progress")
        .single();
      attempt = retried.data;
      error = retried.error;
    } else {
      attempt = inserted.data;
      error = inserted.error;
    }
    if (error || !attempt) fail("새 응시를 시작하지 못했습니다.");
  }

  const { data: rows, error: rowError } = await admin
    .from("attempt_answers")
    .select("*")
    .eq("attempt_id", attempt.id);
  if (rowError) fail("저장된 답안을 불러오지 못했습니다.");
  const draft = rowsToDraft(context, rows ?? []);
  return {
    attemptId: attempt.id,
    startedAt: attempt.started_at,
    expiresAt: attempt.expires_at,
    updatedAt: attempt.updated_at,
    ...draft,
  };
}

export async function saveAttemptDraft(slug: string, attemptId: string, userId: string, input: DraftInput) {
  const admin = createAdminClient();
  const context = await getContext(admin, slug);
  await getAttempt(admin, context, attemptId, userId);
  const rows = buildAnswerRows(context, attemptId, input);
  await syncAnswerRows(admin, attemptId, rows);
  const answeredCount = rows.filter((row) => row.selected_choice_id || String(row.answer_text ?? "").trim()).length;
  const savedAt = new Date().toISOString();
  const { error } = await admin.from("attempts").update({ answered_count: answeredCount, updated_at: savedAt }).eq("id", attemptId);
  if (error) fail("응시 상태를 저장하지 못했습니다.");
  return { savedAt, answeredCount };
}

export async function persistGradingResult(
  slug: string,
  attemptId: string,
  userId: string,
  input: DraftInput,
  result: GradingResult,
): Promise<GradingResult> {
  const admin = createAdminClient();
  const context = await getContext(admin, slug);
  await getAttempt(admin, context, attemptId, userId, true);
  const graded = new Map(result.questions.map((question) => [question.number, { isCorrect: question.isCorrect, awardedScore: question.awardedScore }]));
  const rows = buildAnswerRows(context, attemptId, input, graded);
  await syncAnswerRows(admin, attemptId, rows);

  const sectionByCode = new Map(context.sections.map((section) => [section.code, section]));
  const sectionRows = result.sections.map((sectionResult) => {
    const section = sectionByCode.get(sectionResult.code);
    if (!section) fail(`영역 ${sectionResult.code}를 찾을 수 없습니다.`);
    return {
      attempt_id: attemptId,
      section_id: section.id,
      earned_score: sectionResult.earnedScore,
      max_score: sectionResult.maxScore,
      correct_count: sectionResult.correctCount,
      question_count: sectionResult.questionCount,
      percentage: sectionResult.percentage,
    };
  });
  const { error: sectionError } = await admin.from("section_results").upsert(sectionRows, { onConflict: "attempt_id,section_id" });
  if (sectionError) fail("영역별 결과를 저장하지 못했습니다.");

  const submittedAt = new Date().toISOString();
  const { error: attemptError } = await admin.from("attempts").update({
    status: "graded",
    submitted_at: submittedAt,
    graded_at: submittedAt,
    total_score: result.totalScore,
    correct_count: result.correctCount,
    answered_count: result.answeredCount,
    passed: result.passed,
  }).eq("id", attemptId).eq("user_id", userId);
  if (attemptError) fail("최종 응시 결과를 저장하지 못했습니다.");

  return { ...result, id: attemptId, submittedAt };
}

export async function loadAttemptResult(slug: string, userId: string, attemptId?: string): Promise<GradingResult | null> {
  const admin = createAdminClient();
  const context = await getContext(admin, slug);
  let query = admin
    .from("attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("exam_id", context.exam.id)
    .in("status", ["submitted", "graded"]);
  if (attemptId) query = query.eq("id", attemptId);
  const { data: attempt, error } = await query.order("graded_at", { ascending: false }).limit(1).maybeSingle();
  if (error) fail("채점 결과를 불러오지 못했습니다.");
  if (!attempt) return null;

  const questionIds = context.questions.map((question) => question.id);
  const [{ data: answers, error: answerError }, { data: answerKeys, error: keyError }, { data: sectionResults, error: sectionError }] = await Promise.all([
    admin.from("attempt_answers").select("*").eq("attempt_id", attempt.id),
    admin.from("answer_keys").select("*").in("question_id", questionIds),
    admin.from("section_results").select("*").eq("attempt_id", attempt.id),
  ]);
  if (answerError || keyError || sectionError || !answers || !answerKeys || !sectionResults) fail("상세 채점 결과를 불러오지 못했습니다.");

  const answerByQuestion = new Map(answers.map((answer) => [answer.question_id, answer]));
  const keyByQuestion = new Map((answerKeys as AnswerKeyRow[]).map((key) => [key.question_id, key]));
  const sectionById = new Map(context.sections.map((section) => [section.id, section]));
  const storedSectionById = new Map(sectionResults.map((section) => [section.section_id, section]));

  const questions = context.questions.map((question) => {
    const answer = answerByQuestion.get(question.id);
    const key = keyByQuestion.get(question.id);
    const section = sectionById.get(question.section_id);
    const userChoice = answer?.selected_choice_id ? context.choiceById.get(answer.selected_choice_id) : null;
    const correctChoice = key?.correct_choice_id ? context.choiceById.get(key.correct_choice_id) : null;
    const userAnswer = userChoice ? `${question.number}:${userChoice.label}` : answer?.answer_text ?? "";
    return {
      number: question.number,
      section: section?.code ?? "",
      tags: question.competency_tags,
      prompt: question.prompt,
      userAnswer,
      userAnswerDisplay: userChoice ? `${userChoice.label}. ${userChoice.content}` : userAnswer || "미응답",
      correctAnswer: correctChoice ? `${correctChoice.label}. ${correctChoice.content}` : key?.correct_value ?? "",
      isCorrect: Boolean(answer?.is_correct),
      awardedScore: Number(answer?.awarded_score ?? 0),
      maxScore: Number(question.score),
      explanation: key?.explanation ?? "",
    };
  });

  const sections = context.sections.map((section) => {
    const stored = storedSectionById.get(section.id);
    return {
      code: section.code,
      title: section.title,
      earnedScore: Number(stored?.earned_score ?? 0),
      maxScore: Number(stored?.max_score ?? section.max_score),
      correctCount: stored?.correct_count ?? 0,
      questionCount: stored?.question_count ?? context.questions.filter((question) => question.section_id === section.id).length,
      percentage: Number(stored?.percentage ?? 0),
    };
  });

  const diagnostics = await generateDiagnostics(sections, questions);

  return {
    id: attempt.id,
    examSlug: context.exam.slug,
    examTitle: context.exam.title,
    submittedAt: attempt.submitted_at ?? attempt.graded_at ?? attempt.updated_at,
    totalScore: Number(attempt.total_score ?? 0),
    maxScore: Number(context.exam.total_score),
    passingScore: Number(context.exam.passing_score),
    passed: Boolean(attempt.passed),
    correctCount: attempt.correct_count ?? questions.filter((question) => question.isCorrect).length,
    answeredCount: attempt.answered_count,
    questionCount: questions.length,
    sections,
    questions,
    diagnostics,
  };
}