-- 기존 qna_posts는 이전에 임시로 만들어둔 테스트용 테이블(id bigint, 스키마 불일치)이라 폐기하고 새로 만든다.
drop table if exists public.qna_comments cascade;
drop table if exists public.qna_posts cascade;

create table if not exists public.qna_posts(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,certification_id uuid references public.certifications on delete set null,title text not null,content text not null,is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.qna_comments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.qna_posts on delete cascade,user_id uuid not null references public.profiles on delete cascade,content text not null,is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());

create index if not exists qna_posts_certification_idx on public.qna_posts(certification_id);
create index if not exists qna_posts_user_idx on public.qna_posts(user_id);
create index if not exists qna_comments_post_idx on public.qna_comments(post_id);

drop trigger if exists qna_posts_updated on public.qna_posts;
create trigger qna_posts_updated before update on public.qna_posts for each row execute function public.set_updated_at();
drop trigger if exists qna_comments_updated on public.qna_comments;
create trigger qna_comments_updated before update on public.qna_comments for each row execute function public.set_updated_at();

alter table public.qna_posts enable row level security;
alter table public.qna_comments enable row level security;

drop policy if exists "read qna posts" on public.qna_posts;
create policy "read qna posts" on public.qna_posts for select to authenticated using(is_active or (select auth.uid())=user_id or (select private.is_admin()));
drop policy if exists "own qna posts insert" on public.qna_posts;
create policy "own qna posts insert" on public.qna_posts for insert to authenticated with check((select auth.uid())=user_id);
drop policy if exists "own qna posts update" on public.qna_posts;
create policy "own qna posts update" on public.qna_posts for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists "own qna posts delete" on public.qna_posts;
create policy "own qna posts delete" on public.qna_posts for delete to authenticated using((select auth.uid())=user_id);
drop policy if exists "admin qna posts" on public.qna_posts;
create policy "admin qna posts" on public.qna_posts for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));

drop policy if exists "read qna comments" on public.qna_comments;
create policy "read qna comments" on public.qna_comments for select to authenticated using(is_active or (select auth.uid())=user_id or (select private.is_admin()));
drop policy if exists "own qna comments insert" on public.qna_comments;
create policy "own qna comments insert" on public.qna_comments for insert to authenticated with check((select auth.uid())=user_id);
drop policy if exists "own qna comments update" on public.qna_comments;
create policy "own qna comments update" on public.qna_comments for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
drop policy if exists "own qna comments delete" on public.qna_comments;
create policy "own qna comments delete" on public.qna_comments for delete to authenticated using((select auth.uid())=user_id);
drop policy if exists "admin qna comments" on public.qna_comments;
create policy "admin qna comments" on public.qna_comments for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));
