begin;

-- Explanations are grading data. Keep them beside answer keys so authenticated
-- examinees cannot fetch them before submitting an attempt.
alter table public.answer_keys
  add column if not exists explanation text;

update public.answer_keys as answer_key
set explanation = question.explanation
from public.questions as question
where question.id = answer_key.question_id
  and question.explanation is not null
  and answer_key.explanation is distinct from question.explanation;

update public.questions
set explanation = null
where explanation is not null;

-- RLS filters rows, not columns. Remove the table-level SELECT privilege and
-- grant authenticated examinees only the columns required to take an exam.
revoke select on table public.questions from anon, authenticated;
grant select (
  id,
  exam_id,
  section_id,
  number,
  type,
  prompt,
  instructions,
  score,
  difficulty,
  competency_tags,
  prerequisite_question_id,
  answer_format_hint,
  is_active,
  created_at,
  updated_at
) on table public.questions to authenticated;

comment on column public.answer_keys.explanation is
  'Protected explanation returned by server-side grading after submission.';

commit;