import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import { type DiagnosticLevel, levelLabel } from "@/lib/diagnostic-level";

export { type DiagnosticLevel, levelLabel };
type Rule = Database["public"]["Tables"]["diagnostic_rules"]["Row"];
type SectionScore = { code: string; title: string; earnedScore: number; maxScore: number; correctCount: number; questionCount: number; percentage: number };
type QuestionScore = { tags: string[]; isCorrect: boolean; awardedScore: number; maxScore: number };
export type DiagnosticFeedback = {
  scope: "section" | "competency";
  code: string;
  title: string;
  earnedScore: number;
  maxScore: number;
  correctCount: number;
  questionCount: number;
  percentage: number;
  level: DiagnosticLevel;
  comment: string;
  recommendation: string;
  ruleId: string;
};
export type DiagnosticSummary = { sections: DiagnosticFeedback[]; competencies: DiagnosticFeedback[] };

function matchRule(rules: Rule[], percentage: number, scope: "section" | "competency", code: string) {
  const applicable = rules.filter((rule) => {
    if (percentage < Number(rule.min_percentage) || percentage > Number(rule.max_percentage)) return false;
    if (scope === "section") return rule.section_code === code && rule.competency_tag === null;
    return rule.section_code === null && rule.competency_tag === code;
  });
  const fallback = rules.filter((rule) =>
    rule.section_code === null && rule.competency_tag === null &&
    percentage >= Number(rule.min_percentage) && percentage <= Number(rule.max_percentage),
  );
  return [...applicable, ...fallback].sort((a, b) => b.priority - a.priority)[0];
}

type MinimalRule = Pick<Rule, "id" | "level" | "comment" | "recommendation">;

/** Used when no diagnostic_rules row (not even a generic section_code=null/competency_tag=null
 * fallback) covers a given percentage. A content gap here should degrade to a generic message,
 * not 500 the whole exam's grading/result page for every student. */
function builtinFallbackRule(title: string, percentage: number): MinimalRule {
  const level: DiagnosticLevel = percentage >= 80 ? "strong" : percentage >= 60 ? "developing" : percentage >= 40 ? "weak" : "foundation";
  return {
    id: "builtin-fallback",
    level,
    comment: `${title} 점수는 ${percentage}%입니다.`,
    recommendation: "오답 해설을 확인하고 같은 유형을 다시 풀어보세요.",
  };
}

function feedback(
  scope: "section" | "competency",
  code: string,
  title: string,
  scores: Pick<DiagnosticFeedback, "earnedScore" | "maxScore" | "correctCount" | "questionCount" | "percentage">,
  rule: MinimalRule,
): DiagnosticFeedback {
  return {
    scope, code, title, ...scores,
    level: rule.level as DiagnosticLevel,
    comment: rule.comment,
    recommendation: rule.recommendation ?? "오답 해설을 확인하고 같은 유형을 다시 풀어보세요.",
    ruleId: rule.id,
  };
}

const fetchDiagnosticRules = unstable_cache(
  async (): Promise<Rule[]> => {
    const admin = createAdminClient();
    const { data, error } = await admin.from("diagnostic_rules").select("*").eq("is_active", true).order("priority", { ascending: false });
    if (error || !data) throw new Error("Supabase 진단 규칙을 불러오지 못했습니다.");
    return data as Rule[];
  },
  ["diagnostic_rules_active"],
  { revalidate: 3600, tags: ["diagnostic_rules"] },
);

export async function generateDiagnostics(sections: SectionScore[], questions: QuestionScore[]): Promise<DiagnosticSummary> {
  const rules = await fetchDiagnosticRules();

  const sectionFeedback = sections.map((section) => {
    const rule = matchRule(rules, section.percentage, "section", section.code) ?? builtinFallbackRule(section.title, section.percentage);
    return feedback("section", section.code, section.title, {
      earnedScore: section.earnedScore, maxScore: section.maxScore, correctCount: section.correctCount,
      questionCount: section.questionCount, percentage: section.percentage,
    }, rule);
  });

  const aggregates = new Map<string, { earnedScore: number; maxScore: number; correctCount: number; questionCount: number }>();
  for (const question of questions) for (const tag of question.tags) {
    const current = aggregates.get(tag) ?? { earnedScore: 0, maxScore: 0, correctCount: 0, questionCount: 0 };
    current.earnedScore += question.awardedScore;
    current.maxScore += question.maxScore;
    current.correctCount += question.isCorrect ? 1 : 0;
    current.questionCount += 1;
    aggregates.set(tag, current);
  }
  const competencies = [...aggregates.entries()].map(([tag, score]) => {
    const percentage = score.maxScore ? Number((score.earnedScore / score.maxScore * 100).toFixed(1)) : 0;
    const rule = matchRule(rules, percentage, "competency", tag) ?? builtinFallbackRule(tag, percentage);
    return feedback("competency", tag, tag, {
      earnedScore: Number(score.earnedScore.toFixed(2)), maxScore: Number(score.maxScore.toFixed(2)),
      correctCount: score.correctCount, questionCount: score.questionCount, percentage,
    }, rule);
  }).sort((a, b) => a.percentage - b.percentage || b.questionCount - a.questionCount || a.title.localeCompare(b.title, "ko"));

  return { sections: sectionFeedback, competencies };
}