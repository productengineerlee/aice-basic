// 자격증 문항(지문·보기·정답·자료 이미지)을 해설 작성용 작업 파일로 내보낸다. DB는 읽기만 한다.
// 사용: node scripts/export_questions_for_explanations.mjs <출력폴더>
//   <출력폴더>/<시험slug>.json  : 문항 목록 (이미 해설이 있는 문항도 has_explanation 으로 표시)
//   <출력폴더>/images/<시험slug>/q<번호>.png : 자료 이미지
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

loadEnv(path.join(process.cwd(), ".env.local"));
const outDir = process.argv[2];
if (!outDir) throw new Error("출력 폴더를 지정하세요.");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function must(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

const certs = await must(admin.from("certifications").select("id,code,name"), "certifications");
const certById = new Map(certs.map((c) => [c.id, c]));
const exams = await must(admin.from("exams").select("id,slug,title,certification_id").not("certification_id", "is", null).neq("status", "archived").order("slug"), "exams");

fs.mkdirSync(outDir, { recursive: true });
let total = 0, missing = 0;
for (const exam of exams) {
  const sections = await must(admin.from("exam_sections").select("id,title").eq("exam_id", exam.id), "sections");
  const sectionTitle = new Map(sections.map((s) => [s.id, s.title]));
  const questions = await must(admin.from("questions").select("id,number,section_id,prompt,instructions,image_url,competency_tags").eq("exam_id", exam.id).eq("is_active", true).order("number"), "questions");
  const ids = questions.map((q) => q.id);
  const choices = await must(admin.from("question_choices").select("id,question_id,label,content,sort_order").in("question_id", ids).order("sort_order"), "choices");
  const keys = await must(admin.from("answer_keys").select("question_id,correct_choice_id,explanation").in("question_id", ids), "answer_keys");
  const keyById = new Map(keys.map((k) => [k.question_id, k]));

  const imageDir = path.join(outDir, "images", exam.slug);
  const items = [];
  for (const q of questions) {
    const qChoices = choices.filter((c) => c.question_id === q.id);
    const key = keyById.get(q.id);
    const correctIndex = qChoices.findIndex((c) => c.id === key?.correct_choice_id);
    let image = null;
    if (q.image_url) {
      fs.mkdirSync(imageDir, { recursive: true });
      image = path.join(imageDir, `q${q.number}.png`);
      if (!fs.existsSync(image)) {
        const res = await fetch(q.image_url);
        if (!res.ok) throw new Error(`${exam.slug} q${q.number} 이미지 다운로드 실패: ${res.status}`);
        fs.writeFileSync(image, Buffer.from(await res.arrayBuffer()));
      }
    }
    const hasExplanation = Boolean(key?.explanation?.trim());
    if (!hasExplanation) missing++;
    items.push({
      question_id: q.id,
      number: q.number,
      section: sectionTitle.get(q.section_id) ?? null,
      tags: q.competency_tags,
      prompt: q.prompt,
      instructions: q.instructions,
      image,
      choices: qChoices.map((c, i) => ({ no: i + 1, content: c.content })),
      answer: correctIndex >= 0 ? correctIndex + 1 : null,
      has_explanation: hasExplanation,
    });
  }
  total += items.length;
  const cert = certById.get(exam.certification_id);
  fs.writeFileSync(path.join(outDir, `${exam.slug}.json`), JSON.stringify({ slug: exam.slug, title: exam.title, certification: cert?.name, questions: items }, null, 1));
  const noAnswer = items.filter((i) => i.answer === null).length;
  console.log(`${exam.slug}\t${items.length}문항\t이미지 ${items.filter((i) => i.image).length}\t정답없음 ${noAnswer}`);
}
console.log(`합계 ${total}문항, 해설 없음 ${missing}`);
