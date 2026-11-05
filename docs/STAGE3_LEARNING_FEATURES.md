# 3단계 설계안: 구 gichulbank 학습 기능 이식

작성일: 2026-11-05 · 상위 계획: [GICHULBANK_MIGRATION_PLAN.md](GICHULBANK_MIGRATION_PLAN.md)

## 1. 현황

### 구 gichulbank (`E:\Projects\gichulbank`, Vite SPA) — 참고용
"매일 조금씩 푸는 학습 앱" 모델. 문항 하나씩 풀고 즉시 피드백.

| 기능 | 핵심 로직 | 위치 |
|---|---|---|
| 오답노트·복습 | `wrong_answers(next_review_date, wrong_count, graduated)`. 복습 간격 1→3→7→14→30일, **연속 5회 정답 시 졸업**, 틀리면 즉시 재복습 | `src/lib/api/wrongAnswers.ts` |
| 간격 반복(SM-2) | ease factor 2.5 기반 간격 계산 (실제 오답노트는 위의 고정 간격 사용) | `src/lib/utils/spacedRepetition.ts` |
| 약점 분석 | 카테고리별 가중 점수: 진단 0.3 · 최근 성과 0.4 · 오답 빈도 0.2 · 노출 경과 0.05 · 추세 0.05, 정답률 60% 미만 = 약점 | `src/lib/utils/weaknessAnalysis.ts` |
| 추천 엔진 | 문항 점수: 약점 0.3 · 최근 풀이 감점 0.2 · 난이도 적합 0.2 · 카테고리 균형 0.15 · 간격반복 0.15 | `src/lib/utils/recommendationEngine.ts` |
| 일일 학습 세트 | 하루 N문항 세트 생성 (cron) | `src/lib/api/learning.ts`, `scheduledJobs.ts` |
| 스트릭 | `users.streak_count` + 스트릭 프리즈 | `src/lib/api/streak.ts` |
| 기타 | 업적·보상, 알림, 온보딩 진단, AI 튜터, 카메라 | — |

### 현재 기출뱅크 (이 저장소)
"회차 모의고사" 모델. 회차 단위(시간 제한)로 응시 → 제출 → 일괄 채점.

- 풀이 기록: `attempts → attempt_answers(is_correct)` — 서버 채점, 정답·해설은 `answer_keys`에 숨김(RLS)
- 이미 있는 것: 회차별 결과, 마이페이지 역량(태그)별 성취도, 점수 추이
- 운영 데이터(2026-11-05): 회원 216명, 문항 답안 11,184건, **오답 3,575건**
- **해설 없음**: `answer_keys` 953개 중 해설 83개(AICE분). 자격증 3종 870문항은 해설 0개

## 2. 무엇을 가져오나

| 우선순위 | 기능 | 판단 |
|---|---|---|
| ★ 필수 | 오답노트 + 복습 스케줄 | 기출 서비스 핵심. 기존 오답 3,575건을 바로 채워 넣을 수 있음 |
| ★ 필수 | 문항 단위 연습 모드 | 복습·추천에 필요. 회차 응시와 별개의 "한 문제씩 풀고 즉시 채점" |
| ★ 필수 | 풀이 로그 (시간 포함) | AI 추천의 학습 데이터 (1차 목표) |
| ◎ 권장 | 약점 분석 개편 | 이미 있는 태그별 분석을 자격증별 + 연습 기록 포함으로 확장 |
| ◎ 권장 | 스트릭 (연속 학습일) | 풀이 날짜에서 계산 → cron·카운터 불필요 |
| ○ 다음 | 오늘의 추천 문제 | 규칙 기반 추천(복습 예정 + 약점 태그). 나중에 AI 추천으로 교체 |
| ✕ 보류 | 업적·보상, 알림, 온보딩 진단, AI 튜터, 카메라, 엑셀 업로드 | 회원 확보 단계에선 우선순위 낮음 |

## 3. 데이터 설계 (신규 마이그레이션)

```sql
-- 문항 단위 연습 풀이 로그 (AI 추천 학습 데이터)
create table public.practice_answers(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  question_id uuid not null references public.questions on delete cascade,
  selected_label text not null,
  is_correct boolean not null,
  time_spent_ms integer check (time_spent_ms >= 0),
  mode text not null check (mode in ('review','daily','random')),
  answered_at timestamptz not null default now()
);

-- 오답노트 / 복습 스케줄 (사용자 × 문항 1행)
create table public.review_items(
  user_id uuid not null references public.profiles on delete cascade,
  question_id uuid not null references public.questions on delete cascade,
  wrong_count integer not null default 1,
  correct_streak smallint not null default 0,
  last_wrong_at timestamptz not null,
  next_review_at timestamptz not null,
  graduated_at timestamptz,
  primary key (user_id, question_id)
);
```

- RLS: 본인 행만 읽기. 쓰기는 서버(admin client)에서만 → 채점 조작 방지
- `attempt_answers`에도 `time_spent_ms` 추가(회차 응시 중 문항별 체류 시간, 선택)

## 4. 동작 규칙

- **오답 등록**: 회차 제출 채점 시(`persistGradingResult`) + 연습 모드 오답 시 `review_items` upsert (wrong_count+1, correct_streak=0, 다음 복습=내일)
- **복습 간격**: 오답 → 1일 뒤, 연속 정답 1회 → 3일 뒤, 2회 → 7일 뒤
- **졸업**: 연속 **3회** 정답 (구 버전 5회는 기출 회차 수가 적어 부담 큼)
- **미리 풀기**: 복습일 전에 푼 정답은 기록만 남기고 연속 정답에 반영하지 않음 (벼락치기 졸업 방지)
- **세션**: 한 번에 최대 20문제, 복습 예정 → 많이 틀린 순 → 최근 오답 순
- **백필**: 기존 오답 3,575건을 `review_items`로 한 번에 생성 → 기존 회원도 오답노트가 바로 채워진 상태로 시작
- **연습 채점 API**: `POST /api/practice/answer` — 서버에서 `answer_keys`로 채점, 정답·해설은 제출 후에만 반환

## 5. 화면

| 경로 | 내용 |
|---|---|
| `/review` | 오답노트: 자격증별 탭, "오늘 복습할 문제 N개" + 전체 오답 목록(틀린 횟수·마지막 오답일), 졸업 문제 |
| `/practice?mode=review&cert=…` | 한 문제씩 풀이 → 즉시 정오답·정답 표시 → 다음 문제 |
| `/dashboard` | 오늘 복습 수, 연속 학습일, 이어 풀기 |
| `/mypage` | 자격증 선택 + 태그별 정답률(회차+연습 합산), 약점 태그 상위 5 |
| 결과 화면 | "틀린 문제 N개가 오답노트에 저장됐어요" 안내 |

## 6. 작업 순서

1. ✅ **3-1 DB·오답 수집**: 마이그레이션(두 테이블 + RLS), 채점 시 오답 등록, 기존 오답 백필, `/review` 목록 화면
2. ✅ **3-2 연습 모드**: 연습 채점 API, `/practice` 화면, 복습 스케줄·졸업
3. ✅ **3-3 분석·동기부여** (과목·시대 단위 정답률 + 3문항 이상 유형 약점, 스트릭은 한국 시간 기준 학습일 계산): 약점 분석 개편, 스트릭, 대시보드 개편
4. ✅ **3-4 추천(규칙 기반)** — `src/lib/recommend.ts`: 매일 10문제 = 오답 복습 최대 3 + 정답률 70% 미만 하위 2개 과목의 안 푼 문제 최대 4 + 과목별로 돌아가며 안 푼 문제. 회원·날짜 시드로 하루 동안 같은 세트. AI 추천으로 바꿀 때 이 모듈만 교체: 오늘의 문제 = 복습 예정 + 약점 태그 + 안 푼 문제

각 단계마다 빌드·화면 확인 후 커밋·배포.

## 7. 별도 결정 필요

- **해설**: 자격증 870문항에 해설이 없어 오답노트가 "정답만 보여주는" 상태가 됨. AI로 해설 초안을 생성하고 관리자 검수 후 반영하는 작업을 3단계와 병행할지 결정 필요
- **운영 DB 마이그레이션**: 신규 테이블 추가는 기존 데이터에 영향 없음. 적용 시점 승인 필요
