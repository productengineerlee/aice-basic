import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(process.cwd(), ".env.local"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Supabase 환경변수가 없습니다.");
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const bands = [
  { min: 0, max: 39.99, level: "foundation", phrase: "기초 개념부터 다시 정리해야 합니다.", action: "AIDU 기본 예제를 따라 한 뒤 쉬운 문항부터 다시 풀어보세요." },
  { min: 40, max: 59.99, level: "weak", phrase: "핵심 개념은 일부 이해했지만 적용 연습이 더 필요합니다.", action: "오답 해설을 확인하고 같은 유형을 반복 연습하세요." },
  { min: 60, max: 79.99, level: "developing", phrase: "기본기는 갖추었지만 복합 조건과 결과 해석을 보완해야 합니다.", action: "조건과 출력값을 체크리스트로 확인하며 연습하세요." },
  { min: 80, max: 100, level: "strong", phrase: "안정적으로 이해하고 있습니다.", action: "실전 시간 관리와 고난도 문항으로 숙련도를 높이세요." },
];

const sectionActions = {
  eda: "기술통계량과 시각화 결과를 함께 읽고 데이터 특징을 한 문장으로 요약해 보세요.",
  preprocessing: "결측치·이상치의 탐색 기준과 처리 전후 행 수 변화를 순서대로 확인해 보세요.",
  modeling: "문제 유형에 맞는 목표변수와 알고리즘을 선택하고 학습 설정값을 비교해 보세요.",
  evaluation: "평가 지표의 의미와 변수 영향도·예측 결과 해석을 연결해 연습해 보세요.",
};

const competencyActions = {
  "문제 유형 판단": "목표변수가 범주형인지 연속형인지 먼저 구분하고 분류·회귀 선택 근거를 적어 보세요.",
  "모델 평가 지표": "Accuracy, F1, RMSE 등 지표가 언제 좋은 값인지와 모델 비교 기준을 표로 정리해 보세요.",
  "데이터 이해": "열의 의미, 행 수, 목표변수와 입력변수를 분석 전에 확인하는 습관을 들이세요.",
  "기초통계": "평균·중앙값·최빈값·표준편차가 분포에서 의미하는 바를 예제로 비교해 보세요.",
  "시각화": "그래프의 축과 범례를 먼저 확인한 뒤 최댓값·최솟값·분포 특징을 읽어 보세요.",
  "머신러닝": "각 알고리즘의 입력·출력과 주요 설정값을 AIDU 실습으로 비교해 보세요.",
  "이상치": "이상치 탐지 기준과 제거 전후 데이터 건수 및 모델 영향을 함께 확인해 보세요.",
  "결측치 처리": "삭제와 대체 방법을 구분하고 처리 후 결측치 개수가 0인지 검증해 보세요.",
  "딥러닝": "은닉층·노드·학습 횟수 설정이 성능에 미치는 영향을 한 번에 하나씩 바꿔 비교해 보세요.",
  "변수 영향도": "영향도 순위와 방향을 구분하고 상위 변수가 예측에 미치는 의미를 설명해 보세요.",
  "예측 시뮬레이션": "입력값을 하나씩 바꾸면서 예측값 변화 방향과 크기를 기록해 보세요.",
  "상관관계": "상관계수의 부호와 절댓값을 구분하고 인과관계로 단정하지 않도록 연습하세요.",
  "성능 개선": "전처리·변수·모델 설정 중 한 요소만 바꾸고 동일한 평가 지표로 전후를 비교하세요.",
  "결측치 탐색": "열별 결측치 개수와 비율을 확인하고 결측치가 있는 열을 정확히 식별해 보세요.",
  "데이터 유형": "수치형·범주형·날짜형을 구분하고 각 유형에 가능한 분석 방법을 연결해 보세요.",
  "모델 설정": "학습/검증 분할과 주요 하이퍼파라미터의 역할을 AIDU 화면 순서대로 정리해 보세요.",
};

function stableId(key) {
  const hex = crypto.createHash("sha256").update(`aice-basic-diagnostic:${key}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

const [{ data: sections, error: sectionError }, { data: questions, error: questionError }] = await Promise.all([
  supabase.from("exam_sections").select("code,title"),
  supabase.from("questions").select("competency_tags").eq("is_active", true),
]);
if (sectionError || questionError) throw sectionError ?? questionError;
const uniqueSections = [...new Map((sections ?? []).map((section) => [section.code, section])).values()];
const tags = [...new Set((questions ?? []).flatMap((question) => question.competency_tags ?? []))].sort();
const rows = [];

for (const section of uniqueSections) for (const band of bands) rows.push({
  id: stableId(`section:${section.code}:${band.level}`), section_code: section.code, competency_tag: null,
  min_percentage: band.min, max_percentage: band.max, level: band.level,
  comment: `${section.title} 영역은 ${band.phrase}`,
  recommendation: band.level === "strong" ? band.action : `${band.action} ${sectionActions[section.code] ?? "오답 문항의 작업 순서를 다시 실행해 보세요."}`,
  priority: 80, is_active: true,
});
for (const tag of tags) for (const band of bands) rows.push({
  id: stableId(`competency:${tag}:${band.level}`), section_code: null, competency_tag: tag,
  min_percentage: band.min, max_percentage: band.max, level: band.level,
  comment: `${tag} 역량은 ${band.phrase}`,
  recommendation: band.level === "strong" ? band.action : `${band.action} ${competencyActions[tag] ?? "관련 오답의 AIDU 실행 과정을 다시 확인해 보세요."}`,
  priority: 100, is_active: true,
});
const { error } = await supabase.from("diagnostic_rules").upsert(rows, { onConflict: "id" });
if (error) throw new Error(`진단 규칙 등록 실패 (${error.code}): ${error.message}`);
console.log(JSON.stringify({ sections: uniqueSections.length, competencies: tags.length, rulesUpserted: rows.length }, null, 2));