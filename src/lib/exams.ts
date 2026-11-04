import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ExamKind } from "@/types/database";

export type ExamSummary = {
  slug: string;
  title: string;
  kind: ExamKind;
  durationMinutes: number;
  passingScore: number;
  questionCount: number;
  sections: { code: string; title: string; count: number; score: number }[];
};
export type PublicQuestion = {
  number: number;
  type: string;
  section: string;
  competencyTags: string[];
  prompt: string;
  imageUrl: string | null;
  choices: { id: string; label: string; content: string }[];
  score: number;
  answerFormatHint?: string | null;
};
export type PublicExam = ExamSummary & { questions: PublicQuestion[] };

export async function getExam(slug: string): Promise<PublicExam | null> {
  const admin = createAdminClient();
  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id,slug,title,kind,duration_minutes,passing_score")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (examError) throw new Error("시험을 불러오지 못했습니다.");
  if (!exam) return null;

  const [{ data: sections, error: sectionError }, { data: questions, error: questionError }] = await Promise.all([
    admin.from("exam_sections").select("id,code,title,max_score,sort_order").eq("exam_id", exam.id).order("sort_order"),
    admin.from("questions").select("id,section_id,number,type,prompt,image_url,score,difficulty,competency_tags,answer_format_hint").eq("exam_id", exam.id).eq("is_active", true).order("number"),
  ]);
  if (sectionError || questionError || !sections || !questions) throw new Error("문항 구성을 불러오지 못했습니다.");

  const questionIds = questions.map((question) => question.id);
  const { data: choices, error: choiceError } = questionIds.length
    ? await admin.from("question_choices").select("id,question_id,label,content,sort_order").in("question_id", questionIds).order("sort_order")
    : { data: [], error: null };
  if (choiceError || !choices) throw new Error("문항 보기를 불러오지 못했습니다.");

  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const publicQuestions: PublicQuestion[] = questions.map((question) => ({
    number: question.number,
    type: question.type,
    section: sectionById.get(question.section_id)?.code ?? "",
    competencyTags: question.competency_tags,
    prompt: question.prompt,
    imageUrl: question.image_url,
    choices: choices.filter((choice) => choice.question_id === question.id).map((choice) => ({
      id: `${question.number}:${choice.label}`,
      label: choice.label,
      content: choice.content,
    })),
    score: Number(question.score),
    answerFormatHint: question.answer_format_hint,
  }));

  return {
    slug: exam.slug,
    title: exam.title,
    kind: exam.kind,
    durationMinutes: exam.duration_minutes,
    passingScore: Number(exam.passing_score),
    questionCount: publicQuestions.length,
    sections: sections.map((section) => ({
      code: section.code,
      title: section.title,
      count: questions.filter((question) => question.section_id === section.id).length,
      score: Number(section.max_score),
    })),
    questions: publicQuestions,
  };
}

export type SiteStats = { attemptCount: number; answeredCount: number };

/** Site-wide usage counters for the landing page stat strip. Counts every attempt row
 * regardless of status (in_progress/expired/graded) — a fresh start counts immediately,
 * matching what a visitor would intuitively call "누적 응시 횟수". */
export async function getSiteStats(): Promise<SiteStats> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("attempts").select("answered_count");
  if (error) throw new Error("이용 현황을 불러오지 못했습니다.");
  const rows = data ?? [];
  return {
    attemptCount: rows.length,
    answeredCount: rows.reduce((sum, row) => sum + (row.answered_count ?? 0), 0),
  };
}
