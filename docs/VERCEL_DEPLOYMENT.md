# Vercel 운영 배포 체크리스트

## 1. 환경변수

Vercel Project Settings > Environment Variables에 다음 변수를 등록한다.

| 변수 | Production | Preview | 비고 |
|---|---:|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 예 | 예 | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 예 | 예 | 브라우저 사용 가능 키 |
| `SUPABASE_SECRET_KEY` | 예 | 예 | 서버 전용, 절대 `NEXT_PUBLIC_` 접두사 금지 |
| `NEXT_PUBLIC_SITE_URL` | 예 | 아니요 | `https://운영도메인` |

`NEXT_PUBLIC_SITE_URL`은 Production에만 고정한다. Preview에서는 Vercel이 제공하는 URL 환경변수를 Auth URL 함수가 자동으로 사용한다.

## 2. Supabase Auth URL Configuration

Supabase Dashboard > Authentication > URL Configuration에서 설정한다.

- Site URL: `https://운영도메인`
- Redirect URLs:
  - `https://운영도메인/auth/callback`
  - `http://localhost:3000/**`
  - Preview를 이메일 인증에 사용할 경우 `https://*-팀슬러그.vercel.app/**`

운영 환경에서는 와일드카드 대신 정확한 callback URL을 유지한다. 이메일 템플릿을 직접 수정했다면 링크가 `{{ .RedirectTo }}`를 사용하는지도 확인한다.

## 3. 배포 순서

```powershell
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production preview
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production preview
vercel env add SUPABASE_SECRET_KEY production preview
vercel env add NEXT_PUBLIC_SITE_URL production
vercel deploy
vercel deploy --prod
```

환경변수를 변경한 뒤에는 반드시 새로 배포해야 적용된다.

## 4. 배포 후 확인

- `/` 응답 200과 보안 헤더
- 회원가입 이메일 callback
- 비밀번호 재설정 callback
- 로그인 후 `/dashboard`, `/mypage`
- 관리자 계정의 `/admin`
- CSV Signed URL 다운로드
- 시험 시작, 자동저장, 제출, 중복 제출, 결과 재조회
- Supabase RLS 및 정답·해설 비노출

## 5. 현재 배포 방식

현재 폴더의 `.git`은 정상 Git 저장소가 아니므로 초기 배포는 Vercel CLI 직접 배포를 사용한다. 향후 자동 배포가 필요하면 별도 GitHub 저장소를 초기화해 Vercel Git Integration에 연결한다.