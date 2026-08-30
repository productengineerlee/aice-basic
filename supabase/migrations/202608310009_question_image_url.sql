-- 경영정보시각화능력 일부 문항(차트/그림 식별형)은 지문 이미지 없이는 풀 수 없는데,
-- 최초 PDF 파싱 시 텍스트만 추출하고 이미지를 누락했다. 문항별 지문 이미지를 저장할 컬럼 추가.
alter table public.questions add column image_url text;
