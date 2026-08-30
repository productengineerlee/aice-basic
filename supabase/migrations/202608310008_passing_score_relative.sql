-- passing_score는 원래 "총점이 항상 100점"이라는 가정하에 0~100으로 제한되어 있었다.
-- 경영정보시각화능력처럼 3과목×100점(총점 300)인 시험이 추가되면서, 이 제약을
-- "총점(total_score) 이하"로 완화한다. 기존 AICE 시험(총점 100)은 동작에 변화 없다.
alter table public.exams drop constraint exams_passing_score_check;
alter table public.exams add constraint exams_passing_score_check check(passing_score between 0 and total_score);
