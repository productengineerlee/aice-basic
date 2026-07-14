import { notFound, redirect } from "next/navigation";
import { ExamRunner } from "@/components/exams/exam-runner";
import { getExam } from "@/lib/exams";
import { createClient } from "@/lib/supabase/server";
import "./runner.css";

export default async function TakeExamPage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { slug } = await params;
  const exam = await getExam(slug);
  if (!exam) notFound();
  return <ExamRunner exam={exam}/>;
}