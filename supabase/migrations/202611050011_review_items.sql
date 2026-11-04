-- 3단계(학습 기능): 오답노트·복습 스케줄과 문항 단위 연습 풀이 로그.
-- 설계: docs/STAGE3_LEARNING_FEATURES.md
-- 두 테이블 모두 쓰기는 서버(service role)에서만 한다. 클라이언트에는 본인 행 읽기만 허용해
-- 정오답·복습 상태를 조작할 수 없게 한다.

-- ── 오답노트 / 복습 스케줄 (사용자 × 문항 1행) ──
create table if not exists public.review_items(
  user_id uuid not null references public.profiles on delete cascade,
  question_id uuid not null references public.questions on delete cascade,
  wrong_count integer not null default 1 check (wrong_count >= 0),
  correct_streak smallint not null default 0 check (correct_streak >= 0),
  last_wrong_at timestamptz not null,
  next_review_at timestamptz not null,
  graduated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index if not exists review_items_due_idx on public.review_items(user_id, next_review_at) where graduated_at is null;
create index if not exists review_items_question_idx on public.review_items(question_id);

drop trigger if exists review_items_updated on public.review_items;
create trigger review_items_updated before update on public.review_items for each row execute function public.set_updated_at();

alter table public.review_items enable row level security;
drop policy if exists "own review items read" on public.review_items;
create policy "own review items read" on public.review_items for select to authenticated using((select auth.uid())=user_id);

-- ── 문항 단위 연습 풀이 로그 (AI 추천 학습 데이터, 3-2에서 사용) ──
create table if not exists public.practice_answers(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  question_id uuid not null references public.questions on delete cascade,
  selected_label text not null,
  is_correct boolean not null,
  time_spent_ms integer check (time_spent_ms is null or time_spent_ms >= 0),
  mode text not null check (mode in ('review','daily','random')),
  answered_at timestamptz not null default now()
);
create index if not exists practice_answers_user_idx on public.practice_answers(user_id, answered_at desc);
create index if not exists practice_answers_question_idx on public.practice_answers(question_id);

alter table public.practice_answers enable row level security;
drop policy if exists "own practice answers read" on public.practice_answers;
create policy "own practice answers read" on public.practice_answers for select to authenticated using((select auth.uid())=user_id);

-- ── 오답 기록 함수: 회차 채점·연습 오답 시 서버에서 호출 ──
-- 새 오답이면 1행 생성, 이미 있으면 틀린 횟수 +1, 연속 정답 초기화, 졸업 해제. 다음 복습은 하루 뒤.
create or replace function public.record_wrong_answers(p_user_id uuid, p_question_ids uuid[], p_wrong_at timestamptz default now())
returns void language sql set search_path='' as $$
  insert into public.review_items(user_id, question_id, wrong_count, correct_streak, last_wrong_at, next_review_at, graduated_at)
  select p_user_id, q, 1, 0, p_wrong_at, p_wrong_at + interval '1 day', null
  from (select distinct unnest(p_question_ids) as q) as ids
  on conflict (user_id, question_id) do update set
    wrong_count = public.review_items.wrong_count + 1,
    correct_streak = 0,
    last_wrong_at = excluded.last_wrong_at,
    next_review_at = excluded.next_review_at,
    graduated_at = null;
$$;
revoke all on function public.record_wrong_answers(uuid, uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.record_wrong_answers(uuid, uuid[], timestamptz) to service_role;

-- ── 백필: 기존 자격증 회차 응시의 오답을 오답노트로 옮긴다 ──
-- AICE 시험(certification_id 없음)은 제외. 기존 회원이 바로 복습할 수 있도록 다음 복습일은 지금으로 둔다.
-- 이미 행이 있으면 건드리지 않으므로 여러 번 실행해도 안전하다.
insert into public.review_items(user_id, question_id, wrong_count, correct_streak, last_wrong_at, next_review_at)
select a.user_id, aa.question_id, count(*)::int, 0, max(coalesce(a.graded_at, aa.answered_at)), now()
from public.attempt_answers aa
join public.attempts a on a.id = aa.attempt_id
join public.exams e on e.id = a.exam_id
where aa.is_correct = false
  and a.status in ('graded', 'submitted')
  and e.certification_id is not null
group by a.user_id, aa.question_id
on conflict (user_id, question_id) do nothing;
