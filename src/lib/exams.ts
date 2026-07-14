import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type ExamSummary = {
  slug: string;
  title: string;
  kind: "classification" | "regression" | "mixed";
  durationMinutes: number;
  passingScore: number;
  questionCount: number;
  dataset: string;
  sections: { code: string; title: string; count: number; score: number }[];
};
export type PublicQuestion = {
  number: number;
  type: string;
  section: string;
  competencyTags: string[];
  prompt: string;
  choices: { id: string; label: string; content: string }[];
  score: number;
  answerFormatHint?: string | null;
};
export type PublicExam = ExamSummary & { questions: PublicQuestion[] };

export async function listExams(): Promise<ExamSummary[]> {
  const admin = createAdminClient();
  const { data: exams, error: examError } = await admin
    .from("exams")
    .select("id,slug,title,kind,duration_minutes,passing_score,published_at")
    .eq("status", "published")
    .order("published_at", { ascending: true });
  if (examError) throw new Error("Supabase에서 시험 목록을 불러오지 못했습니다.");
  if (!exams?.length) return [];

  const examIds = exams.map((exam) => exam.id);
  const [{ data: sections, error: sectionError }, { data: questions, error: questionError }, { data: assets, error: assetError }] = await Promise.all([
    admin.from("exam_sections").select("id,exam_id,code,title,max_score,sort_order").in("exam_id", examIds).order("sort_order"),
    admin.from("questions").select("id,exam_id,section_id").in("exam_id", examIds).eq("is_active", true),
    admin.from("exam_assets").select("exam_id,title,object_path,sort_order").in("exam_id", examIds).eq("asset_type", "dataset").order("sort_order"),
  ]);
  if (sectionError || questionError || assetError) throw new Error("Supabase에서 시험 구성을 불러오지 못했습니다.");

  return exams.map((exam) => {
    const examQuestions = (questions ?? []).filter((question) => question.exam_id === exam.id);
    const examSections = (sections ?? []).filter((section) => section.exam_id === exam.id).map((section) => ({
      code: section.code,
      title: section.title,
      count: examQuestions.filter((question) => question.section_id === section.id).length,
      score: Number(section.max_score),
    }));
    const asset = (assets ?? []).find((item) => item.exam_id === exam.id);
    const dataset = asset?.title || asset?.object_path.split("/").at(-1) || "";
    return {
      slug: exam.slug,
      title: exam.title,
      kind: exam.kind,
      durationMinutes: exam.duration_minutes,
      passingScore: Number(exam.passing_score),
      questionCount: examQuestions.length,
      dataset,
      sections: examSections,
    };
  });
}

export async function getExam(slug: string): Promise<PublicExam | null> {
  const admin = createAdminClient();
  const { data: exam, error: examError } = await admin
    .from("exams")
    .select("id,slug,title,kind,duration_minutes,passing_score")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (examError) throw new Error("Supabase에서 시험을 불러오지 못했습니다.");
  if (!exam) return null;

  const [{ data: sections, error: sectionError }, { data: questions, error: questionError }, { data: assets, error: assetError }] = await Promise.all([
    admin.from("exam_sections").select("id,code,title,max_score,sort_order").eq("exam_id", exam.id).order("sort_order"),
    admin.from("questions").select("id,section_id,number,type,prompt,score,difficulty,competency_tags,answer_format_hint").eq("exam_id", exam.id).eq("is_active", true).order("number"),
    admin.from("exam_assets").select("title,object_path,sort_order").eq("exam_id", exam.id).eq("asset_type", "dataset").order("sort_order").limit(1),
  ]);
  if (sectionError || questionError || assetError || !sections || !questions) throw new Error("Supabase에서 문항 구성을 불러오지 못했습니다.");

  const questionIds = questions.map((question) => question.id);
  const { data: choices, error: choiceError } = questionIds.length
    ? await admin.from("question_choices").select("id,question_id,label,content,sort_order").in("question_id", questionIds).order("sort_order")
    : { data: [], error: null };
  if (choiceError || !choices) throw new Error("Supabase에서 문항 보기를 불러오지 못했습니다.");

  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const asset = assets?.[0];
  const dataset = asset?.title || asset?.object_path.split("/").at(-1) || "";
  const publicQuestions: PublicQuestion[] = questions.map((question) => ({
    number: question.number,
    type: question.type,
    section: sectionById.get(question.section_id)?.code ?? "",
    competencyTags: question.competency_tags,
    prompt: question.prompt,
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
    dataset,
    sections: sections.map((section) => ({
      code: section.code,
      title: section.title,
      count: questions.filter((question) => question.section_id === section.id).length,
      score: Number(section.max_score),
    })),
    questions: publicQuestions,
  };
}