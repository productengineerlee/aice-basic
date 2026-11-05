# aice_basic → gichulbank 전환 계획

작성일: 2026-11-05
결정: **aice_basic(이 저장소)을 기준 코드베이스로 삼아 gichulbank 서비스로 리브랜딩**한다.
(이전 `E:\Projects\gichulbank`(Vite SPA, 별도 Supabase)는 기능 참고용으로만 사용)

## 배경 / 목표

- 정부의 국가전문자격·공무원 시험문제 공공저작물 개방에 대비해 기출문제 무료 풀이 서비스 운영
- 1차 목표: 무료 기출로 회원 확보 → 학습 데이터 축적 → **개인 맞춤형 AI 문제 추천**
- 2차 목표: 객관식 → 주관식·서술·논술 확장
- AICE 실습 Lab은 https://license-practice.vercel.app/ 으로 이전 완료 → 이 저장소에서 제거 대상

## 왜 aice_basic 기준인가 (진단 요약)

| 항목 | gichulbank (구) | aice_basic (기준) |
|---|---|---|
| 스택 | Vite + React SPA | Next.js (SSR, SEO 유리) |
| Supabase | 별도 프로젝트 | 운영 중, **실제 회원 보유** |
| 문제 스키마 | 평면 `questions` + 자격증명 텍스트(코드 26개 파일에 하드코딩) | `certifications → exams(회차) → sections → questions → question_choices → answer_keys` |
| 풀이 기록 | study_records, wrong_answers, 스트릭 등 | `attempts → attempt_answers` (문항별 정오답) |
| 문제 데이터 | 업로드 방식 | 한국사 69~79회, 공인중개사, 경영정보시각화 약 870문항 JSON + Storage 이미지 |

- gichulbank로 합치면 **회원(auth.users) 프로젝트 간 이전**, 회차/배점/통계 재구현, 하드코딩 정리가 필요 → 비용·위험 큼
- aice_basic 기준이면 회원·로그인·데이터 그대로, URL 경로도 유지되어 리다이렉트가 단순함

## 작업 목록

### 1단계: AICE 제거 및 리브랜딩
- [ ] AICE 언급 파일(약 20개) 정리: 헤더/푸터 "AICE LAB", 로고, 랜딩 문구, metadata
- [ ] 분류/회귀 실습 관련 코드(약 4개 파일), 데이터셋 다운로드 API(`/api/exams/[slug]/dataset`), `data/exam-datasets`, AICE 이론 콘텐츠 정리
- [ ] DB의 AICE 샘플 시험(exams) `archived` 처리 (삭제보다 보관 — 기존 회원 풀이 기록 보존)
- [ ] `package.json` name, README 갱신
- [ ] 브랜드명 확정 (gichulbank / 기출뱅크 등). 참고: `certiq.vercel.app`은 타인이 사용 중

### 2단계: 도메인 전환 — ✅ 완료 (2026-11-05)
- [x] 리다이렉트 코드 준비: `next.config.ts` 에 host 조건 308 리다이렉트 (`aice-basic.vercel.app` → `gichulbank.vercel.app`, 경로·쿼리 유지, `/auth/callback` 만 옛 도메인에서 처리). 로컬 검증 후 배포
- [x] (사용자) Vercel 환경변수 `NEXT_PUBLIC_SITE_URL` = `https://gichulbank.vercel.app`, Supabase Site URL·Redirect URLs 변경 — 사용자가 완료했다고 알림
- [x] (사용자) Vercel에 `gichulbank.vercel.app` 도메인 추가 — 새 대시보드에서는 Settings 메뉴에 Domains 항목이 없고 Environments(Production) 화면에 도메인 목록이 있음
- [x] 새 도메인 200 확인 후 리다이렉트 배포
- [ ] 배포 후 검증: 옛 주소 → 새 주소 308(경로 유지), 새 주소 페이지·로그인 정상
- [ ] `aice-basic.vercel.app` 도메인은 삭제하지 말고 계속 연결 유지
- [ ] 안내: 기존 회원은 새 주소에서 1회 재로그인 필요 (쿠키가 도메인별)
- [ ] 이름이 이미 사용 중이면: 다른 vercel.app 이름 또는 독자 도메인 구매 검토

### 3단계: gichulbank(구) 학습 기능 이식 — ✅ 완료 (상세: STAGE3_LEARNING_FEATURES.md)
- [x] 오답노트 + 간격 반복 복습 (/review, /practice)
- [x] 약점 분석 (과목·시대별 + 유형별, /mypage)
- [x] 스트릭, 오늘의 추천 10문제 (업적·보상은 보류)
- 로직은 `E:\Projects\gichulbank\src\lib\api\*` 참고, 데이터는 `attempt_answers` 기반으로 재구성

### 4단계: AI 추천 대비 데이터 정비
- [ ] `attempt_answers`에 문항별 풀이 시간 컬럼 추가
- [ ] `questions.competency_tags`, `difficulty` 일관되게 채우기
- [ ] 문제 단위 연습 모드(회차 모의고사 외) 로그도 같은 구조로 저장

### 마무리
- [x] 메인화면(랜딩) 디자인 개편 (밝은 학습앱 + 회원 개인화 요약)
- [ ] 기존 `E:\Projects\gichulbank` 폴더: 모든 작업 완료 후 최종 확인을 거쳐 삭제 (그 전까지 기능 이식 참고용으로 유지)
- [ ] 폴더명 `aice_basic` → `gichulbank` 변경 (구 폴더 삭제 후)

## 주의
- 공공저작물 개방이 서비스 내 원문 재배포 허용과 같은 의미인지, 시험별 공공누리 유형(상업적 이용·변경 금지 여부) 확인 필요 (한국사: 국사편찬위원회, 공인중개사: 한국산업인력공단)
