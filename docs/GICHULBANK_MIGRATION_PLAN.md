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

### 2단계: 도메인 전환
- [ ] Vercel 프로젝트 이름 변경, 도메인 `gichulbank.vercel.app` 추가 (2026-11-05 확인 시 DEPLOYMENT_NOT_FOUND → 사용 가능성 높음)
- [ ] `aice-basic.vercel.app` → `gichulbank.vercel.app` **308 영구 리다이렉트** (Vercel Domains 설정 또는 `next.config.ts` 의 host 조건 redirects). 경로 유지됨
- [ ] `aice-basic.vercel.app` 도메인은 삭제하지 말고 계속 연결 유지
- [ ] Supabase Auth: Site URL / Redirect URLs 새 주소로 변경 (이메일 인증·비밀번호 재설정)
- [ ] 안내: 기존 회원은 새 주소에서 1회 재로그인 필요 (쿠키가 도메인별)
- [ ] 장기: 독자 도메인 구매 검토

### 3단계: gichulbank(구) 학습 기능 이식
- [ ] 오답노트 + 간격 반복 복습
- [ ] 약점 분석 (섹션/태그별)
- [ ] 스트릭·업적, 일일 학습 세트
- 로직은 `E:\Projects\gichulbank\src\lib\api\*` 참고, 데이터는 `attempt_answers` 기반으로 재구성

### 4단계: AI 추천 대비 데이터 정비
- [ ] `attempt_answers`에 문항별 풀이 시간 컬럼 추가
- [ ] `questions.competency_tags`, `difficulty` 일관되게 채우기
- [ ] 문제 단위 연습 모드(회차 모의고사 외) 로그도 같은 구조로 저장

## 주의
- 공공저작물 개방이 서비스 내 원문 재배포 허용과 같은 의미인지, 시험별 공공누리 유형(상업적 이용·변경 금지 여부) 확인 필요 (한국사: 국사편찬위원회, 공인중개사: 한국산업인력공단)
