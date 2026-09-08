import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type TheoryItem = { id: string; sectionCode: string; competencyTag: string | null; title: string; body: string };
export type TheorySection = { code: string; title: string; overview: TheoryItem | null; topics: TheoryItem[] };

// 시험 채점 영역(exam_sections)에 속하지 않는 보충 콘텐츠. 진단 엔진·문항 태그와는 무관하게
// theory_content.section_code만으로 연결되는 별도 섹션이라 exam_sections 테이블에는 추가하지 않는다.
export const EXTRA_THEORY_SECTIONS = [{ code: "ai_overview", title: "AI 개요", sort_order: 5 }];

// certificationId가 null이면 AICE BASIC(certification_id가 null인 exams) 소속 영역만 가져온다.
// exam_sections/theory_content가 모든 자격증(공인중개사·한국사 등)과 테이블을 공유하기 때문에
// 이 필터가 없으면 다른 자격증의 영역까지 함께 섞여 나온다.
export const listTheoryContent = unstable_cache(
  async (certificationId: string | null = null): Promise<TheorySection[]> => {
    const admin = createAdminClient();
    const examsQuery = admin.from("exams").select("id");
    const { data: exams, error: examsError } = certificationId === null
      ? await examsQuery.is("certification_id", null)
      : await examsQuery.eq("certification_id", certificationId);
    if (examsError) throw new Error("핵심이론을 불러오지 못했습니다.");
    const examIds = (exams ?? []).map((exam) => exam.id);

    const [{ data: sections, error: sectionError }, { data: content, error: contentError }] = await Promise.all([
      admin.from("exam_sections").select("code,title,sort_order").in("exam_id", examIds).order("sort_order"),
      admin.from("theory_content").select("id,section_code,competency_tag,title,body").eq("is_active", true).order("sort_order"),
    ]);
    if (sectionError || contentError) throw new Error("핵심이론을 불러오지 못했습니다.");

    const uniqueSections = [...new Map((sections ?? []).map((section) => [section.code, section])).values(), ...EXTRA_THEORY_SECTIONS]
      .sort((a, b) => a.sort_order - b.sort_order);
    return uniqueSections.map((section) => {
      const items = (content ?? [])
        .filter((item) => item.section_code === section.code)
        .map((item): TheoryItem => ({ id: item.id, sectionCode: item.section_code, competencyTag: item.competency_tag, title: item.title, body: item.body }));
      return {
        code: section.code,
        title: section.title,
        overview: items.find((item) => !item.competencyTag) ?? null,
        topics: items.filter((item) => item.competencyTag),
      };
    });
  },
  ["theory_content_active"],
  { revalidate: 3600, tags: ["theory_content"] },
);
