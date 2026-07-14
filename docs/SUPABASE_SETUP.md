# Supabase 설정 안내

Supabase 프로젝트 생성 후 `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 입력합니다. Service Role 키는 서버에서만 사용합니다.

`supabase/migrations/202607120001_initial_schema.sql`을 Dashboard SQL Editor에서 실행하거나 Supabase CLI의 `supabase db push`로 적용합니다.

Authentication에서 Email provider와 Confirm email을 활성화하고 개발·Vercel URL의 `/auth/callback`을 Redirect URL에 등록합니다. 회원가입 시 `birth_date`를 user metadata로 전달해야 프로필 트리거가 정상 동작합니다.

최초 관리자 지정 SQL:

```sql
update public.profiles set role='admin'
where id=(select id from auth.users where email='ADMIN_EMAIL');
```
