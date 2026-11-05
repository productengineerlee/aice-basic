// 2025년 제36회 공인중개사 정답을 한국산업인력공단 최종정답(data/gongin/official-answers-2025.json)에 맞추고,
// 이미 채점된 응시 기록을 다시 채점한다.
//   node scripts/fix_gongin_2025_answer_keys.mjs          확인만 (DB 쓰기 없음)
//   node scripts/fix_gongin_2025_answer_keys.mjs --apply  정답 수정 + 재채점 + 오답노트 정리
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadEnv(filePath) {
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

const root = process.cwd();
loadEnv(path.join(root, ".env.local"));
const apply = process.argv.includes("--apply");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const official = JSON.parse(fs.readFileSync(path.join(root, "data/gongin/official-answers-2025.json"), "utf8"));
// 시험 slug → [원본 파일, 번호 오프셋] (2차는 1교시 80문항 + 2교시 40문항을 1~120번으로 이어 붙였다)
const EXAMS = { "gongin-2025-1cha": [["1cha.json", 0]], "gongin-2025-2cha": [["2cha-1gyosi.json", 0], ["2cha-2gyosi.json", 80]] };

async function must(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

// 1) 원본 JSON 정답도 같이 고친다 (시드를 다시 돌려도 틀린 정답이 돌아오지 않게)
for (const [file, answers] of Object.entries(official)) {
  if (file.startsWith("_")) continue;
  const filePath = path.join(root, "data/gongin", file);
  const doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const changed = answers.flatMap((ans, i) => (doc[String(i + 1)].answer !== ans ? [`${i + 1}(${doc[String(i + 1)].answer}→${ans})`] : []));
  if (changed.length) console.log(`${file}: 정답 수정 ${changed.join(" ")}`);
  if (apply && changed.length) {
    answers.forEach((ans, i) => { doc[String(i + 1)].answer = ans; });
    fs.writeFileSync(filePath, JSON.stringify(doc, null, 1) + "\n");
  }
}

for (const [slug, parts] of Object.entries(EXAMS)) {
  const exam = await must(admin.from("exams").select("id,passing_score").eq("slug", slug).single(), "exam");
  const sections = await must(admin.from("exam_sections").select("id,max_score,min_score").eq("exam_id", exam.id), "sections");
  const questions = await must(admin.from("questions").select("id,number,section_id,score").eq("exam_id", exam.id), "questions");
  const ids = questions.map((q) => q.id);
  const choices = await must(admin.from("question_choices").select("id,question_id,sort_order").in("question_id", ids).order("sort_order"), "choices");
  const keys = await must(admin.from("answer_keys").select("question_id,correct_choice_id").in("question_id", ids), "keys");
  const keyById = new Map(keys.map((k) => [k.question_id, k.correct_choice_id]));
  const questionById = new Map(questions.map((q) => [q.id, q]));

  const officialByNumber = new Map();
  for (const [file, offset] of parts) official[file].forEach((ans, i) => officialByNumber.set(offset + i + 1, ans));

  // 2) 정답 키 수정
  const correctChoice = new Map(); // question_id → 공식 정답 choice id
  const fixed = [];
  for (const q of questions) {
    const qChoices = choices.filter((c) => c.question_id === q.id);
    const target = qChoices[officialByNumber.get(q.number) - 1];
    if (!target) throw new Error(`${slug} ${q.number}번: 공식 정답 보기를 찾을 수 없음`);
    correctChoice.set(q.id, target.id);
    if (keyById.get(q.id) !== target.id) fixed.push(q);
  }
  console.log(`${slug}: 정답 수정 ${fixed.length}문항 (${fixed.map((q) => q.number).sort((a, b) => a - b).join(",")})`);
  if (!fixed.length) continue;
  if (apply) {
    for (const q of fixed) {
      const { error } = await admin.from("answer_keys").update({ correct_choice_id: correctChoice.get(q.id) }).eq("question_id", q.id);
      if (error) throw new Error(`${slug} ${q.number}번 정답 수정 실패: ${error.message}`);
    }
  }

  // 3) 수정된 문항이 들어간 채점 완료 응시를 다시 채점
  const fixedIds = fixed.map((q) => q.id);
  const touched = await must(admin.from("attempt_answers").select("attempt_id").in("question_id", fixedIds), "touched");
  const attemptIds = [...new Set(touched.map((r) => r.attempt_id))];
  const attempts = attemptIds.length ? await must(admin.from("attempts").select("id,user_id,status,total_score,correct_count,passed").in("id", attemptIds).eq("status", "graded"), "attempts") : [];
  for (const attempt of attempts) {
    const answers = await must(admin.from("attempt_answers").select("id,question_id,selected_choice_id,is_correct,awarded_score").eq("attempt_id", attempt.id), "answers");
    const regraded = answers.map((a) => {
      const q = questionById.get(a.question_id);
      const isCorrect = Boolean(a.selected_choice_id) && a.selected_choice_id === correctChoice.get(a.question_id);
      return { ...a, isCorrect, score: isCorrect ? Number(q.score) : 0, changed: fixedIds.includes(a.question_id) && isCorrect !== a.is_correct };
    });
    const total = Number(regraded.reduce((s, a) => s + a.score, 0).toFixed(2));
    const correctCount = regraded.filter((a) => a.isCorrect).length;
    const sectionRows = sections.map((section) => {
      const rows = regraded.filter((a) => questionById.get(a.question_id).section_id === section.id);
      const earned = Number(rows.reduce((s, a) => s + a.score, 0).toFixed(2));
      return { section, earned, correct: rows.filter((a) => a.isCorrect).length, percentage: Number(section.max_score) ? Number((earned / Number(section.max_score) * 100).toFixed(1)) : 0 };
    });
    const passed = total >= Number(exam.passing_score) && sectionRows.every((r) => r.section.min_score === null || r.earned >= Number(r.section.min_score));
    const changed = regraded.filter((a) => a.changed);
    console.log(`  응시 ${attempt.id.slice(0, 8)}: ${attempt.total_score}점→${total}점, 정답 ${attempt.correct_count}→${correctCount}, 합격 ${attempt.passed}→${passed}, 판정 바뀐 문항 ${changed.length}`);
    if (!apply) continue;

    for (const a of changed) {
      const { error } = await admin.from("attempt_answers").update({ is_correct: a.isCorrect, awarded_score: a.score }).eq("id", a.id);
      if (error) throw new Error(`답안 재채점 실패: ${error.message}`);
    }
    for (const r of sectionRows) {
      const { error } = await admin.from("section_results").update({ earned_score: r.earned, correct_count: r.correct, percentage: r.percentage }).eq("attempt_id", attempt.id).eq("section_id", r.section.id);
      if (error) throw new Error(`영역 결과 수정 실패: ${error.message}`);
    }
    const { error } = await admin.from("attempts").update({ total_score: total, correct_count: correctCount, passed }).eq("id", attempt.id);
    if (error) throw new Error(`응시 결과 수정 실패: ${error.message}`);

    // 4) 오답노트: 이제 맞은 문항은 빼고, 이제 틀린 문항은 넣는다
    const nowCorrect = changed.filter((a) => a.isCorrect).map((a) => a.question_id);
    const nowWrong = changed.filter((a) => !a.isCorrect).map((a) => a.question_id);
    if (nowCorrect.length) {
      const { error: delError } = await admin.from("review_items").delete().eq("user_id", attempt.user_id).in("question_id", nowCorrect).is("graduated_at", null);
      if (delError) throw new Error(`오답노트 정리 실패: ${delError.message}`);
    }
    if (nowWrong.length) {
      const { error: rpcError } = await admin.rpc("record_wrong_answers", { p_user_id: attempt.user_id, p_question_ids: nowWrong, p_wrong_at: new Date().toISOString() });
      if (rpcError) throw new Error(`오답노트 추가 실패: ${rpcError.message}`);
    }
  }
}
console.log(apply ? "반영 완료" : "확인만 했습니다. 반영하려면 --apply");
