# AICE BASIC 샘플 문제 데이터

- `sample-exams.json`: 분류 3세트, 회귀 3세트의 문제·보기·정답·영역·세부역량·해설 데이터
- `validation-report.json`: 문항 수, 배점 합계, 누락 및 원문 교정 내역
- `../../supabase/seed_sample_exams.sql`: Supabase 초기 스키마에 바로 입력할 수 있는 멱등 시드 SQL

## 영역 코드

- `eda`: 탐색적 데이터 분석
- `preprocessing`: 데이터 전처리
- `modeling`: AI 모델링
- `evaluation`: 모델 성능평가

각 시험은 100점으로 재배점했습니다. 객관식은 `choice_label`, 주관식은 `value`와 `grading_type`을 사용합니다. AIDU 실행 결과처럼 변동 가능성이 있는 소수형 문항에는 `decimal_places`와 `tolerance`가 포함됩니다.

원문 해설지에서 정답 번호와 정답 문구가 불일치한 3문항은 문구와 해설 내용을 기준으로 올바른 보기 ID로 교정했으며, 상세 내역은 검수 리포트에 기록했습니다.
