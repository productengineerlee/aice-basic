import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type CertificationSummary = { id: string; code: string; name: string; description: string | null; examCount: number };

export type CertificationSchedule = {
  id: string;
  roundName: string;
  examDate: string | null;
  applyStart: string | null;
  applyEnd: string | null;
  notes: string | null;
};

export type CertificationExam = { slug: string; title: string; durationMinutes: number; questionCount: number };

export type CertificationDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  schedules: CertificationSchedule[];
  exams: CertificationExam[];
};

export async function listCertifications(): Promise<CertificationSummary[]> {
  const admin = createAdminClient();
  const { data: certifications, error } = await admin
    .from("certifications")
    .select("id,code,name,description")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error("Supabase에서 자격증 목록을 불러오지 못했습니다.");
  if (!certifications?.length) return [];

  const { data: exams, error: examError } = await admin
    .from("exams")
    .select("certification_id")
    .in("certification_id", certifications.map((cert) => cert.id))
    .eq("status", "published");
  if (examError) throw new Error("Supabase에서 자격증 시험 수를 불러오지 못했습니다.");

  return certifications.map((cert) => ({
    ...cert,
    examCount: (exams ?? []).filter((exam) => exam.certification_id === cert.id).length,
  }));
}

export async function getCertification(code: string): Promise<CertificationDetail | null> {
  const admin = createAdminClient();
  const { data: cert, error } = await admin
    .from("certifications")
    .select("id,code,name,description")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error("Supabase에서 자격증을 불러오지 못했습니다.");
  if (!cert) return null;

  const [{ data: schedules, error: scheduleError }, { data: exams, error: examError }] = await Promise.all([
    admin.from("certification_schedules").select("id,round_name,exam_date,apply_start,apply_end,notes").eq("certification_id", cert.id).order("sort_order"),
    admin.from("exams").select("id,slug,title,duration_minutes").eq("certification_id", cert.id).eq("status", "published").order("published_at", { ascending: true }),
  ]);
  if (scheduleError || examError || !exams) throw new Error("Supabase에서 자격증 상세 정보를 불러오지 못했습니다.");

  const examIds = exams.map((exam) => exam.id);
  const { data: questions, error: questionError } = examIds.length
    ? await admin.from("questions").select("exam_id").in("exam_id", examIds).eq("is_active", true)
    : { data: [], error: null };
  if (questionError) throw new Error("Supabase에서 자격증 문항 수를 불러오지 못했습니다.");

  return {
    id: cert.id,
    code: cert.code,
    name: cert.name,
    description: cert.description,
    schedules: (schedules ?? []).map((schedule) => ({
      id: schedule.id, roundName: schedule.round_name, examDate: schedule.exam_date,
      applyStart: schedule.apply_start, applyEnd: schedule.apply_end, notes: schedule.notes,
    })),
    exams: exams.map((exam) => ({
      slug: exam.slug, title: exam.title, durationMinutes: exam.duration_minutes,
      questionCount: (questions ?? []).filter((question) => question.exam_id === exam.id).length,
    })),
  };
}
