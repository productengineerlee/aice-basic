import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll, fetchByIds } from "@/lib/supabase/paging";
import type { PracticeQuestion } from "@/lib/review";

/**
 * 오늘의 추천 문제 (규칙 기반). 나중에 AI 추천 모델로 바꿀 때 이 모듈만 교체하면 되도록
 * 입력(풀이 기록·오답노트)과 출력(PracticeQuestion 목록)을 분리해 둔다.
 *
 * 구성 (기본 10문제)
 *  1) 복습: 오답노트에서 오늘 복습할 문제 (최대 3)
 *  2) 약점: 정답률이 가장 낮은 과목(시대) 2개에서 아직 안 푼 문제 (최대 4)
 *  3) 골고루: 나머지는 아직 안 푼 문제를 과목별로 돌아가며 채움
 * 같은 날·같은 회원에게는 같은 세트가 나오도록 날짜 기반 시드로 섞는다.
 */
export const DAILY_SET_SIZE = 10;
const MAX_REVIEW = 3;
const MAX_WEAK = 4;
const WEAK_SECTION_COUNT = 2;
const WEAK_ACCURACY = 70;
const MIN_SECTION_ANSWERS = 5;

export type DailyQuestion = PracticeQuestion & { reason: "review" | "weak" | "new" | "retry"; reasonLabel: string };
export type DailySet = { certCode: string; certName: string; questions: DailyQuestion[]; total: number; doneToday: number };

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** 문자열 → 32bit 시드, mulberry32 난수 */
function seededRandom(seedText: string) {
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) seed = Math.imul(31, seed) + seedText.charCodeAt(i) | 0;
  return () => {
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function loadDailySet(userId: string, certCode: string): Promise<DailySet | null> {
  const admin = createAdminClient();
  const { data: cert } = await admin.from("certifications").select("id,code,name").eq("code", certCode).eq("is_active", true).maybeSingle();
  if (!cert) return null;

  const { data: exams, error: examError } = await admin.from("exams").select("id,title").eq("certification_id", cert.id).eq("status", "published");
  if (examError) throw new Error("시험 정보를 불러오지 못했습니다.");
  const examIds = (exams ?? []).map((exam) => exam.id);
  if (!examIds.length) return { certCode: cert.code, certName: cert.name, questions: [], total: 0, doneToday: 0 };

  const now = Date.now();
  const todayStartIso = new Date(Math.floor((now + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS).toISOString();

  const [questions, sections, attempts, practice] = await Promise.all([
    fetchByIds(examIds, (chunk, from, to) => admin.from("questions").select("id,exam_id,section_id,number,prompt,image_url,competency_tags").in("exam_id", chunk).eq("is_active", true).order("id").range(from, to)),
    fetchByIds(examIds, (chunk, from, to) => admin.from("exam_sections").select("id,code,title,sort_order").in("exam_id", chunk).order("id").range(from, to)),
    fetchAll((from, to) => admin.from("attempts").select("id").eq("user_id", userId).eq("status", "graded").in("exam_id", examIds).order("id").range(from, to)),
    fetchAll((from, to) => admin.from("practice_answers").select("id,question_id,is_correct,mode,answered_at").eq("user_id", userId).order("id").range(from, to)),
  ]);
  const questionIds = new Set(questions.map((question) => question.id));
  const [examAnswers, reviews] = await Promise.all([
    fetchByIds(attempts.map((attempt) => attempt.id), (chunk, from, to) => admin.from("attempt_answers").select("id,question_id,is_correct").in("attempt_id", chunk).order("id").range(from, to)),
    fetchAll((from, to) => admin.from("review_items").select("question_id,wrong_count,correct_streak,next_review_at,graduated_at").eq("user_id", userId).is("graduated_at", null).order("question_id").range(from, to)),
  ]);

  // 오늘 추천 세트에서 이미 푼 문제는 "푼 기록"에서 빼고 세트를 만든 뒤 마지막에 제외한다.
  // (그래야 문제를 풀어 나가도 오늘 세트 구성이 바뀌지 않는다)
  const isTodayDaily = (row: { mode: string; answered_at: string }) => row.mode === "daily" && row.answered_at >= todayStartIso;
  const doneTodayIds = new Set(practice.filter((row) => questionIds.has(row.question_id) && isTodayDaily(row)).map((row) => row.question_id));
  const history = [
    ...examAnswers.map((row) => ({ questionId: row.question_id, isCorrect: Boolean(row.is_correct) })),
    ...practice.filter((row) => !isTodayDaily(row)).map((row) => ({ questionId: row.question_id, isCorrect: row.is_correct })),
  ].filter((row) => questionIds.has(row.questionId));
  const seen = new Set(history.map((row) => row.questionId));

  // 과목(시대)은 회차마다 행이 달라도 code로 묶는다.
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const sectionCodeOf = (questionId: string) => sectionById.get(questionById.get(questionId)?.section_id ?? "")?.code ?? "";
  const sectionStats = new Map<string, { title: string; order: number; answered: number; correct: number }>();
  for (const section of sections) if (!sectionStats.has(section.code)) sectionStats.set(section.code, { title: section.title, order: section.sort_order, answered: 0, correct: 0 });
  for (const row of history) {
    const stat = sectionStats.get(sectionCodeOf(row.questionId));
    if (!stat) continue;
    stat.answered += 1;
    stat.correct += row.isCorrect ? 1 : 0;
  }

  const random = seededRandom(`${userId}:${todayStartIso}:${cert.code}`);
  const picked: { id: string; reason: DailyQuestion["reason"]; reasonLabel: string }[] = [];
  const pickedIds = new Set<string>();
  const take = (id: string, reason: DailyQuestion["reason"], reasonLabel: string) => {
    if (picked.length >= DAILY_SET_SIZE || pickedIds.has(id)) return;
    picked.push({ id, reason, reasonLabel });
    pickedIds.add(id);
  };

  // 1) 복습: 오늘 복습일이거나 오늘 추천 세트에서 이미 푼 오답노트 문제
  const reviewByQuestion = new Map(reviews.filter((row) => questionIds.has(row.question_id)).map((row) => [row.question_id, row]));
  const dueReviews = [...reviewByQuestion.values()]
    .filter((row) => new Date(row.next_review_at).getTime() <= now || doneTodayIds.has(row.question_id))
    .sort((a, b) => b.wrong_count - a.wrong_count || a.question_id.localeCompare(b.question_id));
  for (const row of shuffle(dueReviews.slice(0, MAX_REVIEW * 3), random).slice(0, MAX_REVIEW)) take(row.question_id, "review", "오답 복습");

  // 2) 약점 과목에서 안 푼 문제
  const unseenBySection = new Map<string, string[]>();
  for (const question of shuffle(questions, random)) {
    if (seen.has(question.id)) continue;
    const code = sectionCodeOf(question.id);
    unseenBySection.set(code, [...(unseenBySection.get(code) ?? []), question.id]);
  }
  const weakSections = [...sectionStats.entries()]
    .filter(([, stat]) => stat.answered >= MIN_SECTION_ANSWERS && stat.correct / stat.answered * 100 < WEAK_ACCURACY)
    .sort((a, b) => a[1].correct / a[1].answered - b[1].correct / b[1].answered)
    .slice(0, WEAK_SECTION_COUNT);
  let weakTaken = 0;
  for (let round = 0; weakTaken < MAX_WEAK && round < MAX_WEAK; round++) {
    for (const [code, stat] of weakSections) {
      const id = unseenBySection.get(code)?.[round];
      if (id && weakTaken < MAX_WEAK) { take(id, "weak", `약점 · ${stat.title}`); weakTaken++; }
    }
  }

  // 3) 골고루: 과목 순서대로 돌아가며 안 푼 문제
  const orderedCodes = [...sectionStats.entries()].sort((a, b) => a[1].order - b[1].order).map(([code]) => code);
  for (let round = 0; picked.length < DAILY_SET_SIZE; round++) {
    let added = false;
    for (const code of orderedCodes) {
      const id = unseenBySection.get(code)?.[round];
      if (id) { take(id, "new", `새 문제 · ${sectionStats.get(code)?.title ?? ""}`); added = true; }
    }
    if (!added) break;
  }

  // 4) 다 풀어본 회원: 예전에 틀렸던 문제부터 다시
  if (picked.length < DAILY_SET_SIZE) {
    const wrongBefore = shuffle([...new Set(history.filter((row) => !row.isCorrect).map((row) => row.questionId))], random);
    for (const id of wrongBefore) take(id, "retry", "다시 풀기");
    for (const id of shuffle([...seen], random)) take(id, "retry", "다시 풀기");
  }

  const total = picked.length;
  const remaining = picked.filter((item) => !doneTodayIds.has(item.id));
  const choices = remaining.length
    ? await fetchByIds(remaining.map((item) => item.id), (chunk, from, to) => admin.from("question_choices").select("question_id,label,content,sort_order").in("question_id", chunk).order("question_id").order("sort_order").range(from, to))
    : [];
  const choicesByQuestion = Map.groupBy(choices, (choice) => choice.question_id);
  const examTitleById = new Map((exams ?? []).map((exam) => [exam.id, exam.title]));

  return {
    certCode: cert.code,
    certName: cert.name,
    total,
    doneToday: total - remaining.length,
    questions: remaining.map(({ id, reason, reasonLabel }) => {
      const question = questionById.get(id)!;
      const review = reviewByQuestion.get(id);
      return {
        questionId: id,
        certificationName: cert.name,
        examTitle: examTitleById.get(question.exam_id) ?? "",
        number: question.number,
        prompt: question.prompt,
        imageUrl: question.image_url,
        tags: question.competency_tags,
        wrongCount: review?.wrong_count ?? 0,
        correctStreak: review?.correct_streak ?? 0,
        choices: (choicesByQuestion.get(id) ?? []).map((choice) => ({ label: choice.label, content: choice.content })),
        reason,
        reasonLabel,
      };
    }),
  };
}
