import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type TheoryItem = { id: string; sectionCode: string; competencyTag: string | null; title: string; body: string };
export type TheorySection = { code: string; title: string; overview: TheoryItem | null; topics: TheoryItem[] };

export const listTheoryContent = unstable_cache(
  async (): Promise<TheorySection[]> => {
    const admin = createAdminClient();
    const [{ data: sections, error: sectionError }, { data: content, error: contentError }] = await Promise.all([
      admin.from("exam_sections").select("code,title,sort_order").order("sort_order"),
      admin.from("theory_content").select("id,section_code,competency_tag,title,body").eq("is_active", true).order("sort_order"),
    ]);
    if (sectionError || contentError) throw new Error("Supabase에서 핵심이론을 불러오지 못했습니다.");

    const uniqueSections = [...new Map((sections ?? []).map((section) => [section.code, section])).values()];
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
