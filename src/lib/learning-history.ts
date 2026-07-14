import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AttemptStatus } from "@/types/database";

const PAGE_SIZE = 10;
const ANALYTICS_ATTEMPT_LIMIT = 30;

export type HistoryItem = {
  id: string;
  examId: string;
  examSlug: string;
  examTitle: string;
  status: AttemptStatus;
  startedAt: string;
  resultAt: string | null;
  totalScore: number | null;
  maxScore: number;
  percentage: number | null;
  passed: boolean | null;
  correctCount: number | null;
  answeredCount: number;
};
export type TrendItem = { id: string; examTitle: string; examSlug: string; date: string; score: number; percentage: number; passed: boolean };
export type CompetencyHistory = {
  tag: string;
  percentage: number;
  earnedScore: number;
  maxScore: number;
  correctCount: number;
  questionCount: number;
  level: string;
  comment: string;
  recommendation: string;
};
export type LearningHistory = {
  exams: { id: string; slug: string; title: string; totalScore: number }[];
  history: HistoryItem[];
  currentPage: number;
  totalPages: number;
  totalAttempts: number;
  selectedExamId: string;
  summary: { gradedCount: number; averagePercentage: number; bestPercentage: number; passRate: number };
  trends: TrendItem[];
  competencies: CompetencyHistory[];
  analyticsAttemptCount: number;
};

const percentage = (score: number, maxScore: number) => maxScore > 0 ? Number((score / maxScore * 100).toFixed(1)) : 0;

export async function loadLearningHistory(userId: string, requestedPage: number, requestedExamId: string): Promise<LearningHistory> {
  const admin = createAdminClient();
  const { data: examRows, error: examError } = await admin.from("exams").select("id,slug,title,total_score").order("created_at");
  if (examError || !examRows) throw new Error("시험 정보를 불러오지 못했습니다.");
  const exams = examRows.map(exam => ({ id: exam.id, slug: exam.slug, title: exam.title, totalScore: Number(exam.total_score) }));
  const examById = new Map(exams.map(exam => [exam.id, exam]));
  const selectedExamId = examById.has(requestedExamId) ? requestedExamId : "";
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let countQuery = admin.from("attempts").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (selectedExamId) countQuery = countQuery.eq("exam_id", selectedExamId);
  const { count, error: countError } = await countQuery;
  if (countError) throw new Error("응시 기록 수를 확인하지 못했습니다.");
  const totalAttempts = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalAttempts / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const from = (currentPage - 1) * PAGE_SIZE;
  let historyQuery = admin.from("attempts").select("id,exam_id,status,started_at,submitted_at,graded_at,total_score,passed,correct_count,answered_count").eq("user_id", userId).order("started_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  if (selectedExamId) historyQuery = historyQuery.eq("exam_id", selectedExamId);

  const [{ data: historyRows, error: historyError }, { data: gradedRows, error: gradedError }] = await Promise.all([
    historyQuery,
    admin.from("attempts").select("id,exam_id,graded_at,submitted_at,total_score,passed").eq("user_id", userId).eq("status", "graded").not("total_score", "is", null).order("graded_at", { ascending: true }),
  ]);
  if (historyError || gradedError || !historyRows || !gradedRows) throw new Error("학습 이력을 불러오지 못했습니다.");

  const history: HistoryItem[] = historyRows.map(row => {
    const exam = examById.get(row.exam_id);
    const maxScore = exam?.totalScore ?? 100;
    const score = row.total_score === null ? null : Number(row.total_score);
    return { id: row.id, examId: row.exam_id, examSlug: exam?.slug ?? "", examTitle: exam?.title ?? "삭제되거나 보관된 시험", status: row.status, startedAt: row.started_at, resultAt: row.graded_at ?? row.submitted_at, totalScore: score, maxScore, percentage: score === null ? null : percentage(score, maxScore), passed: row.passed, correctCount: row.correct_count, answeredCount: row.answered_count };
  });

  const graded = gradedRows.map(row => {
    const exam = examById.get(row.exam_id);
    const score = Number(row.total_score ?? 0);
    return { ...row, score, exam, percentage: percentage(score, exam?.totalScore ?? 100) };
  });
  const gradedCount = graded.length;
  const averagePercentage = gradedCount ? Number((graded.reduce((sum, item) => sum + item.percentage, 0) / gradedCount).toFixed(1)) : 0;
  const bestPercentage = gradedCount ? Math.max(...graded.map(item => item.percentage)) : 0;
  const passRate = gradedCount ? Number((graded.filter(item => item.passed).length / gradedCount * 100).toFixed(1)) : 0;
  const trends: TrendItem[] = graded.slice(-12).map(item => ({ id: item.id, examTitle: item.exam?.title ?? "모의고사", examSlug: item.exam?.slug ?? "", date: item.graded_at ?? item.submitted_at ?? new Date().toISOString(), score: item.score, percentage: item.percentage, passed: Boolean(item.passed) }));

  const analyticsAttempts = graded.slice(-ANALYTICS_ATTEMPT_LIMIT);
  const attemptIds = analyticsAttempts.map(item => item.id);
  const { data: answers, error: answerError } = attemptIds.length
    ? await admin.from("attempt_answers").select("attempt_id,question_id,is_correct,awarded_score").in("attempt_id", attemptIds)
    : { data: [], error: null };
  if (answerError || !answers) throw new Error("역량별 답안 이력을 불러오지 못했습니다.");
  const questionIds = [...new Set(answers.map(answer => answer.question_id))];
  const [{ data: questions, error: questionError }, { data: rules, error: ruleError }] = await Promise.all([
    questionIds.length ? admin.from("questions").select("id,score,competency_tags").in("id", questionIds) : Promise.resolve({ data: [], error: null }),
    admin.from("diagnostic_rules").select("id,section_code,competency_tag,min_percentage,max_percentage,level,comment,recommendation,priority").eq("is_active", true),
  ]);
  if (questionError || ruleError || !questions || !rules) throw new Error("역량 진단 기준을 불러오지 못했습니다.");
  const questionById = new Map(questions.map(question => [question.id, question]));
  const aggregate = new Map<string, { earnedScore: number; maxScore: number; correctCount: number; questionCount: number }>();
  for (const answer of answers) {
    const question = questionById.get(answer.question_id);
    if (!question) continue;
    for (const tag of question.competency_tags) {
      const current = aggregate.get(tag) ?? { earnedScore: 0, maxScore: 0, correctCount: 0, questionCount: 0 };
      current.earnedScore += Number(answer.awarded_score ?? 0);
      current.maxScore += Number(question.score);
      current.correctCount += answer.is_correct ? 1 : 0;
      current.questionCount += 1;
      aggregate.set(tag, current);
    }
  }
  const competencies: CompetencyHistory[] = [...aggregate.entries()].map(([tag, score]) => {
    const value = percentage(score.earnedScore, score.maxScore);
    const exact = rules.filter(rule => rule.section_code === null && rule.competency_tag === tag && value >= Number(rule.min_percentage) && value <= Number(rule.max_percentage));
    const fallback = rules.filter(rule => rule.section_code === null && rule.competency_tag === null && value >= Number(rule.min_percentage) && value <= Number(rule.max_percentage));
    const rule = [...exact, ...fallback].sort((a, b) => b.priority - a.priority)[0];
    return { tag, percentage: value, earnedScore: Number(score.earnedScore.toFixed(2)), maxScore: Number(score.maxScore.toFixed(2)), correctCount: score.correctCount, questionCount: score.questionCount, level: rule?.level ?? "foundation", comment: rule?.comment ?? `${tag} 역량의 반복 연습이 필요합니다.`, recommendation: rule?.recommendation ?? "관련 오답과 AIDU 실행 과정을 다시 확인해 보세요." };
  }).sort((a, b) => a.percentage - b.percentage || b.questionCount - a.questionCount || a.tag.localeCompare(b.tag, "ko"));

  return { exams, history, currentPage, totalPages, totalAttempts, selectedExamId, summary: { gradedCount, averagePercentage, bestPercentage, passRate }, trends, competencies, analyticsAttemptCount: analyticsAttempts.length };
}
