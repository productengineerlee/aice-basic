import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/paging";
import type { AttemptStatus } from "@/types/database";

const PAGE_SIZE = 10;
const TREND_LIMIT = 12;

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
export type LearningHistory = {
  exams: { id: string; slug: string; title: string; totalScore: number }[];
  history: HistoryItem[];
  currentPage: number;
  totalPages: number;
  totalAttempts: number;
  selectedExamId: string;
  summary: { gradedCount: number; averagePercentage: number; bestPercentage: number; passRate: number };
  trends: TrendItem[];
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

  // 요약 지표(평균·최고·합격률)는 채점 완료된 전체 응시 기준, 점수 추이는 최근 TREND_LIMIT회.
  const [{ data: historyRows, error: historyError }, gradedRows] = await Promise.all([
    historyQuery,
    fetchAll((from, to) => admin.from("attempts").select("id,exam_id,graded_at,submitted_at,total_score,passed").eq("user_id", userId).eq("status", "graded").not("total_score", "is", null).order("graded_at", { ascending: false }).order("id").range(from, to), "학습 이력을 불러오지 못했습니다."),
  ]);
  if (historyError || !historyRows) throw new Error("학습 이력을 불러오지 못했습니다.");

  const history: HistoryItem[] = historyRows.map(row => {
    const exam = examById.get(row.exam_id);
    const maxScore = exam?.totalScore ?? 100;
    const score = row.total_score === null ? null : Number(row.total_score);
    return { id: row.id, examId: row.exam_id, examSlug: exam?.slug ?? "", examTitle: exam?.title ?? "삭제되거나 보관된 시험", status: row.status, startedAt: row.started_at, resultAt: row.graded_at ?? row.submitted_at, totalScore: score, maxScore, percentage: score === null ? null : percentage(score, maxScore), passed: row.passed, correctCount: row.correct_count, answeredCount: row.answered_count };
  });

  // gradedRows는 DESC 순서로 조회되므로 역순 정렬하여 오래된 순으로 변환
  const graded = gradedRows.slice().reverse().map(row => {
    const exam = examById.get(row.exam_id);
    const score = Number(row.total_score ?? 0);
    return { ...row, score, exam, percentage: percentage(score, exam?.totalScore ?? 100) };
  });
  const gradedCount = graded.length;
  const averagePercentage = gradedCount ? Number((graded.reduce((sum, item) => sum + item.percentage, 0) / gradedCount).toFixed(1)) : 0;
  const bestPercentage = gradedCount ? Math.max(...graded.map(item => item.percentage)) : 0;
  const passRate = gradedCount ? Number((graded.filter(item => item.passed).length / gradedCount * 100).toFixed(1)) : 0;
  const trends: TrendItem[] = graded.slice(-TREND_LIMIT).map(item => ({ id: item.id, examTitle: item.exam?.title ?? "모의고사", examSlug: item.exam?.slug ?? "", date: item.graded_at ?? item.submitted_at ?? new Date().toISOString(), score: item.score, percentage: item.percentage, passed: Boolean(item.passed) }));

  return { exams, history, currentPage, totalPages, totalAttempts, selectedExamId, summary: { gradedCount, averagePercentage, bestPercentage, passRate }, trends };
}
