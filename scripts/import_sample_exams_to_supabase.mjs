import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;

    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(root, ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SECRET_KEY가 없습니다.");
}

const parsedUrl = new URL(supabaseUrl);
if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith(".supabase.co")) {
  throw new Error("Supabase URL 형식이 올바르지 않습니다.");
}
if (!secretKey.startsWith("sb_secret_")) {
  throw new Error("SUPABASE_SECRET_KEY 형식이 올바르지 않습니다.");
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const data = JSON.parse(
  fs.readFileSync(
    path.join(root, "data", "sample-exams", "sample-exams.json"),
    "utf8",
  ),
);

const sectionMetadata = {
  eda: { title: "탐색적 데이터 분석", sortOrder: 1 },
  preprocessing: { title: "데이터 전처리", sortOrder: 2 },
  modeling: { title: "AI 모델링", sortOrder: 3 },
  evaluation: { title: "모델 성능평가", sortOrder: 4 },
};

function roundScore(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function upsertOne(table, values, onConflict, select = "id") {
  const { data: row, error } = await supabase
    .from(table)
    .upsert(values, { onConflict })
    .select(select)
    .single();

  if (error) {
    throw new Error(`${table} 저장 실패 (${error.code ?? "unknown"}): ${error.message}`);
  }
  return row;
}

const totals = {
  exams: 0,
  assets: 0,
  sections: 0,
  questions: 0,
  choices: 0,
  answerKeys: 0,
};

for (const exam of data.exams) {
  const totalScore = roundScore(
    exam.questions.reduce((sum, question) => sum + question.score, 0),
  );

  const examRow = await upsertOne(
    "exams",
    {
      slug: exam.slug,
      title: exam.title,
      description: "제공된 공식 샘플 자료를 구조화한 학습용 모의고사",
      kind: exam.kind,
      status: "published",
      duration_minutes: exam.duration_minutes,
      passing_score: exam.passing_score,
      total_score: totalScore,
      fixed_order: true,
      published_at: new Date().toISOString(),
    },
    "slug",
  );
  totals.exams += 1;

  if (exam.dataset) {
    await upsertOne(
      "exam_assets",
      {
        exam_id: examRow.id,
        asset_type: "dataset",
        title: exam.dataset,
        bucket_id: "exam-datasets",
        object_path: `${exam.slug}/${exam.dataset}`,
        is_downloadable: true,
        sort_order: 1,
      },
      "bucket_id,object_path",
    );
    totals.assets += 1;
  }

  const sectionScores = new Map();
  for (const question of exam.questions) {
    sectionScores.set(
      question.section,
      roundScore((sectionScores.get(question.section) ?? 0) + question.score),
    );
  }

  const sectionIds = new Map();
  for (const [code, maxScore] of sectionScores) {
    const metadata = sectionMetadata[code];
    if (!metadata) throw new Error(`알 수 없는 영역 코드: ${code}`);

    const sectionRow = await upsertOne(
      "exam_sections",
      {
        exam_id: examRow.id,
        code,
        title: metadata.title,
        max_score: maxScore,
        sort_order: metadata.sortOrder,
      },
      "exam_id,code",
    );
    sectionIds.set(code, sectionRow.id);
    totals.sections += 1;
  }

  for (const question of exam.questions) {
    const sectionId = sectionIds.get(question.section);
    if (!sectionId) throw new Error(`문항 ${question.number}의 영역이 없습니다.`);

    const questionRow = await upsertOne(
      "questions",
      {
        exam_id: examRow.id,
        section_id: sectionId,
        number: question.number,
        type: question.type,
        prompt: question.prompt,
        score: question.score,
        difficulty: question.difficulty,
        competency_tags: question.competency_tags,
        is_active: true,
      },
      "exam_id,number",
    );
    totals.questions += 1;

    const choiceIds = new Map();
    for (const [index, choice] of question.choices.entries()) {
      const choiceRow = await upsertOne(
        "question_choices",
        {
          question_id: questionRow.id,
          label: choice.label,
          content: choice.content,
          sort_order: index + 1,
        },
        "question_id,label",
      );
      choiceIds.set(choice.label, choiceRow.id);
      totals.choices += 1;
    }

    const correctChoiceId = question.answer.choice_label
      ? choiceIds.get(question.answer.choice_label)
      : null;
    if (question.answer.choice_label && !correctChoiceId) {
      throw new Error(`문항 ${question.number}의 정답 보기를 찾지 못했습니다.`);
    }

    const { error: answerError } = await supabase.from("answer_keys").upsert(
      {
        question_id: questionRow.id,
        grading_type: question.answer.grading_type,
        correct_choice_id: correctChoiceId ?? null,
        correct_value:
          question.answer.value === null || question.answer.value === undefined
            ? null
            : String(question.answer.value),
        decimal_places: question.answer.decimal_places,
        tolerance: question.answer.tolerance,
        explanation: question.explanation,
      },
      { onConflict: "question_id" },
    );
    if (answerError) {
      throw new Error(
        `answer_keys 저장 실패 (${answerError.code ?? "unknown"}): ${answerError.message}`,
      );
    }
    totals.answerKeys += 1;
  }

  console.log(`IMPORTED ${exam.slug}: ${exam.questions.length} questions`);
}

console.log(`IMPORT_COMPLETE ${JSON.stringify(totals)}`);
