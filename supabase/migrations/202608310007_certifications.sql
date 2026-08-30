-- 자격증(경영정보시각화능력 등) 문제풀이 서비스를 위한 스키마.
-- exams/exam_sections/questions/... 는 손대지 않고 재사용하며, exams.certification_id로
-- "이 시험이 어떤 자격증에 속하는지"만 표시한다(null이면 기존 AICE 모의고사).
create table public.certifications(id uuid primary key default gen_random_uuid(),code text not null unique,name text not null,description text,is_active boolean not null default true,sort_order smallint not null default 0,created_at timestamptz not null default now());

alter table public.exams add column certification_id uuid references public.certifications on delete cascade;
create index if not exists exams_certification_id_idx on public.exams(certification_id);

-- 경영정보시각화능력처럼 "과목당 최소 점수 + 평균 커트라인"을 함께 요구하는 시험을 위한
-- 과목별 최소 통과 점수. null이면 기존 AICE처럼 총점 기준만 본다.
alter table public.exam_sections add column min_score numeric(6,2);

create table public.certification_schedules(id uuid primary key default gen_random_uuid(),certification_id uuid not null references public.certifications on delete cascade,round_name text not null,exam_date date,apply_start date,apply_end date,notes text,sort_order smallint not null default 0,created_at timestamptz not null default now());
create index if not exists certification_schedules_certification_id_idx on public.certification_schedules(certification_id);

-- 구글폼으로 이미 수집한 응답의 "익명 집계"만 저장한다. 이메일 등 개인 식별 정보는
-- 반입하지 않고, 문항별 응시 수/정답 수만 보관해 실제 응시(attempts) 통계와 합산한다.
create table public.question_stat_seed(question_id uuid primary key references public.questions on delete cascade,attempt_count integer not null default 0,correct_count integer not null default 0);

alter table public.certifications enable row level security;
drop policy if exists "certifications read" on public.certifications;
create policy "certifications read" on public.certifications for select to anon,authenticated using(is_active=true);

alter table public.certification_schedules enable row level security;
drop policy if exists "certification_schedules read" on public.certification_schedules;
create policy "certification_schedules read" on public.certification_schedules for select to anon,authenticated using(true);

alter table public.question_stat_seed enable row level security;
drop policy if exists "question_stat_seed read" on public.question_stat_seed;
create policy "question_stat_seed read" on public.question_stat_seed for select to anon,authenticated using(true);
