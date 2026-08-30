import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type QuestionStat = {
  questionId: string;
  examSlug: string;
  examTitle: string;
  number: number;
  prompt: string;
  sectionCode: string;
  tags: string[];
  attemptCount: number;
  correctCount: number;
  accuracy: number;
};

export type TagStat = { tag: string; attemptCount: number; correctCount: number; accuracy: number; questionCount: number };
export type SectionStat = { code: string; title: string; attemptCount: number; correctCount: number; accuracy: number; questionCount: number };

export type CertificationStats = {
  questionCount: number;
  attemptCount: number;
  sectionStats: SectionStat[];
  tagStats: TagStat[];
  hardestQuestions: QuestionStat[];
};

function accuracyOf(attemptCount: number, correctCount: number) {
  return attemptCount ? Number((correctCount / attemptCount * 100).toFixed(1)) : 0;
}

const HARDEST_MIN_ATTEMPTS = 5;
const HARDEST_LIMIT = 10;

export async function getCertificationStats(certificationId: string): Promise<CertificationStats> {
  const admin = createAdminClient();
  const { data: exams, error: examError } = await admin.from("exams").select("id,slug,title").eq("certification_id", certificationId);
  if (examError) throw new Error("Supabase에서 자격증 시험 목록을 불러오지 못했습니다.");
  const examIds = (exams ?? []).map((exam) => exam.id);
  if (!examIds.length) return { questionCount: 0, attemptCount: 0, sectionStats: [], tagStats: [], hardestQuestions: [] };
  const examById = new Map((exams ?? []).map((exam) => [exam.id, exam]));

  const [{ data: sections, error: sectionError }, { data: questions, error: questionError }] = await Promise.all([
    admin.from("exam_sections").select("id,exam_id,code,title").in("exam_id", examIds),
    admin.from("questions").select("id,exam_id,section_id,number,prompt,competency_tags").in("exam_id", examIds).eq("is_active", true),
  ]);
  if (sectionError || questionError || !sections || !questions) throw new Error("Supabase에서 자격증 문항 구성을 불러오지 못했습니다.");
  const sectionById = new Map(sections.map((section) => [section.id, section]));

  const questionIds = questions.map((question) => question.id);
  const [{ data: seedRows, error: seedError }, { data: liveAnswers, error: liveError }] = await Promise.all([
    admin.from("question_stat_seed").select("question_id,attempt_count,correct_count").in("question_id", questionIds),
    admin.from("attempt_answers").select("question_id,is_correct").in("question_id", questionIds).not("is_correct", "is", null),
  ]);
  if (seedError || liveError) throw new Error("Supabase에서 자격증 통계를 불러오지 못했습니다.");

  const countsByQuestion = new Map<string, { attempt: number; correct: number }>();
  for (const row of seedRows ?? []) countsByQuestion.set(row.question_id, { attempt: row.attempt_count, correct: row.correct_count });
  for (const answer of liveAnswers ?? []) {
    const current = countsByQuestion.get(answer.question_id) ?? { attempt: 0, correct: 0 };
    current.attempt += 1;
    if (answer.is_correct) current.correct += 1;
    countsByQuestion.set(answer.question_id, current);
  }

  const questionStats: QuestionStat[] = questions.map((question) => {
    const counts = countsByQuestion.get(question.id) ?? { attempt: 0, correct: 0 };
    const exam = examById.get(question.exam_id);
    return {
      questionId: question.id,
      examSlug: exam?.slug ?? "",
      examTitle: exam?.title ?? "",
      number: question.number,
      prompt: question.prompt,
      sectionCode: sectionById.get(question.section_id)?.code ?? "",
      tags: question.competency_tags,
      attemptCount: counts.attempt,
      correctCount: counts.correct,
      accuracy: accuracyOf(counts.attempt, counts.correct),
    };
  });

  const sectionAgg = new Map<string, { title: string; attempt: number; correct: number; questionCount: number }>();
  for (const stat of questionStats) {
    const section = sections.find((item) => item.code === stat.sectionCode);
    const current = sectionAgg.get(stat.sectionCode) ?? { title: section?.title ?? stat.sectionCode, attempt: 0, correct: 0, questionCount: 0 };
    current.attempt += stat.attemptCount;
    current.correct += stat.correctCount;
    current.questionCount += 1;
    sectionAgg.set(stat.sectionCode, current);
  }
  const sectionStats: SectionStat[] = [...sectionAgg.entries()].map(([code, agg]) => ({
    code, title: agg.title, attemptCount: agg.attempt, correctCount: agg.correct, accuracy: accuracyOf(agg.attempt, agg.correct), questionCount: agg.questionCount,
  }));

  const tagAgg = new Map<string, { attempt: number; correct: number; questionCount: number }>();
  for (const stat of questionStats) for (const tag of stat.tags) {
    const current = tagAgg.get(tag) ?? { attempt: 0, correct: 0, questionCount: 0 };
    current.attempt += stat.attemptCount;
    current.correct += stat.correctCount;
    current.questionCount += 1;
    tagAgg.set(tag, current);
  }
  const tagStats: TagStat[] = [...tagAgg.entries()]
    .map(([tag, agg]) => ({ tag, attemptCount: agg.attempt, correctCount: agg.correct, accuracy: accuracyOf(agg.attempt, agg.correct), questionCount: agg.questionCount }))
    .sort((a, b) => a.accuracy - b.accuracy || a.tag.localeCompare(b.tag, "ko"));

  const hardestQuestions = questionStats
    .filter((stat) => stat.attemptCount >= HARDEST_MIN_ATTEMPTS)
    .sort((a, b) => a.accuracy - b.accuracy || b.attemptCount - a.attemptCount)
    .slice(0, HARDEST_LIMIT);

  const attemptCount = questionStats.reduce((sum, stat) => sum + stat.attemptCount, 0);
  return { questionCount: questionStats.length, attemptCount, sectionStats, tagStats, hardestQuestions };
}

export type WrongAnswerItem = {
  attemptId: string;
  examSlug: string;
  examTitle: string;
  submittedAt: string | null;
  number: number;
  prompt: string;
  choices: { label: string; content: string }[];
  selectedLabel: string | null;
  correctLabel: string | null;
  explanation: string | null;
};

export async function getWrongAnswerNotebook(userId: string, certificationId: string): Promise<WrongAnswerItem[]> {
  const admin = createAdminClient();
  const { data: exams, error: examError } = await admin.from("exams").select("id,slug,title").eq("certification_id", certificationId);
  if (examError) throw new Error("Supabase에서 자격증 시험 목록을 불러오지 못했습니다.");
  const examIds = (exams ?? []).map((exam) => exam.id);
  if (!examIds.length) return [];
  const examById = new Map((exams ?? []).map((exam) => [exam.id, exam]));

  const { data: attempts, error: attemptError } = await admin
    .from("attempts").select("id,exam_id,submitted_at")
    .eq("user_id", userId).in("exam_id", examIds).in("status", ["submitted", "graded"]);
  if (attemptError) throw new Error("Supabase에서 응시 기록을 불러오지 못했습니다.");
  const attemptIds = (attempts ?? []).map((attempt) => attempt.id);
  if (!attemptIds.length) return [];
  const attemptById = new Map((attempts ?? []).map((attempt) => [attempt.id, attempt]));

  const { data: wrongAnswers, error: wrongError } = await admin
    .from("attempt_answers").select("attempt_id,question_id,selected_choice_id")
    .eq("is_correct", false).in("attempt_id", attemptIds);
  if (wrongError) throw new Error("Supabase에서 오답을 불러오지 못했습니다.");
  if (!wrongAnswers?.length) return [];
  const questionIds = [...new Set(wrongAnswers.map((answer) => answer.question_id))];

  const [{ data: questions, error: questionError }, { data: choices, error: choiceError }, { data: answerKeys, error: keyError }] = await Promise.all([
    admin.from("questions").select("id,exam_id,number,prompt").in("id", questionIds),
    admin.from("question_choices").select("id,question_id,label,content").in("question_id", questionIds).order("sort_order"),
    admin.from("answer_keys").select("question_id,correct_choice_id,explanation").in("question_id", questionIds),
  ]);
  if (questionError || choiceError || keyError || !questions || !choices || !answerKeys) throw new Error("Supabase에서 오답노트 문항 정보를 불러오지 못했습니다.");
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const keyByQuestion = new Map(answerKeys.map((key) => [key.question_id, key]));
  const choiceById = new Map(choices.map((choice) => [choice.id, choice]));

  return wrongAnswers
    .map((answer) => {
      const question = questionById.get(answer.question_id);
      if (!question) return null;
      const exam = examById.get(question.exam_id);
      const attempt = attemptById.get(answer.attempt_id);
      const key = keyByQuestion.get(question.id);
      return {
        attemptId: answer.attempt_id,
        examSlug: exam?.slug ?? "",
        examTitle: exam?.title ?? "",
        submittedAt: attempt?.submitted_at ?? null,
        number: question.number,
        prompt: question.prompt,
        choices: choices.filter((choice) => choice.question_id === question.id).map((choice) => ({ label: choice.label, content: choice.content })),
        selectedLabel: answer.selected_choice_id ? choiceById.get(answer.selected_choice_id)?.label ?? null : null,
        correctLabel: key?.correct_choice_id ? choiceById.get(key.correct_choice_id)?.label ?? null : null,
        explanation: key?.explanation ?? null,
      } satisfies WrongAnswerItem;
    })
    .filter((item): item is WrongAnswerItem => item !== null)
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "") || a.number - b.number);
}
