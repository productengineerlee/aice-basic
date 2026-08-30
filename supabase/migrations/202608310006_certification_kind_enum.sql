-- 자격증 문제풀이(경영정보시각화능력 등)는 분류/회귀가 아닌 순수 객관식 문제풀이라
-- exam_kind에 'quiz'를 추가한다. Postgres는 같은 트랜잭션에서 추가한 enum 값을
-- 바로 사용할 수 없으므로, 이 값을 사용하는 다음 마이그레이션과 파일을 분리한다.
alter type public.exam_kind add value if not exists 'quiz';
