create table if not exists public.theory_content(id uuid primary key default gen_random_uuid(),section_code text not null,competency_tag text,title text not null,body text not null,sort_order smallint not null default 0,is_active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());

create index if not exists theory_content_section_code_idx on public.theory_content(section_code);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end$$;
drop trigger if exists theory_content_updated on public.theory_content;
create trigger theory_content_updated before update on public.theory_content for each row execute function public.set_updated_at();

alter table public.theory_content enable row level security;

drop policy if exists "theory content read" on public.theory_content;
create policy "theory content read" on public.theory_content for select to anon,authenticated using(is_active=true);

insert into public.theory_content(section_code,competency_tag,title,body,sort_order) values
('eda',null,'탐색적 데이터 분석 개요','본격적으로 모델을 만들기 전에, 데이터가 어떤 값들로 이루어져 있는지 먼저 파악하는 단계입니다. 변수의 유형, 분포, 결측치·이상치 여부를 확인하면 이후 전처리와 모델링 방향을 정하는 데 도움이 됩니다.',0),
('eda','기초통계','기초통계','평균·중앙값·최빈값·표준편차는 데이터의 중심과 퍼짐 정도를 나타냅니다. 이상치가 있는 데이터에서는 평균보다 중앙값이 더 안정적인 대표값이 됩니다. AIDU의 데이터 분석 - 기초정보분석 메뉴에서 변수별 통계량을 바로 확인할 수 있습니다.',1),
('eda','시각화','시각화','히스토그램은 하나의 수치형 변수 분포를, 박스차트는 사분위수와 이상치를 함께 보여줍니다. 그래프를 읽을 때는 축의 단위와 범례를 먼저 확인한 뒤 최댓값·최솟값·분포 특징을 읽어야 합니다.',2),
('eda','상관관계','상관관계','상관계수는 -1~1 사이 값으로, 두 변수가 함께 움직이는 정도를 나타냅니다. 값이 1에 가까울수록 강한 양의 상관관계, -1에 가까울수록 강한 음의 상관관계입니다. 상관관계가 높다고 해서 인과관계가 있는 것은 아니라는 점에 주의하세요.',3),
('eda','이상치','이상치','IQR(사분위범위, Q3-Q1) 기준으로 Q1-1.5×IQR 미만이거나 Q3+1.5×IQR을 초과하는 값을 이상치로 봅니다. 박스차트에서 상자 바깥의 점으로 표시되며, 처리 전 원인을 먼저 살펴보는 것이 좋습니다.',4),
('preprocessing',null,'데이터 전처리 개요','실제 데이터는 결측치나 형식이 제각각인 값을 포함하는 경우가 많습니다. 모델이 데이터를 올바르게 학습하려면, 학습에 들어가기 전에 결측치를 처리하고 변수 형식을 통일하는 과정이 필요합니다.',0),
('preprocessing','결측치 처리','결측치 처리','결측치는 삭제하거나 대체(imputation)할 수 있습니다. 수치형 변수는 평균·중앙값으로, 범주형 변수는 최빈값으로 대체하는 것이 일반적입니다. 처리 후에는 결측치 개수가 0인지 반드시 확인하세요.',1),
('preprocessing','인코딩','인코딩·스케일링','범주형 변수는 모델이 이해할 수 있도록 숫자로 변환(인코딩)해야 합니다. 수치형 변수는 값의 범위 차이가 클 때 정규화·표준화로 스케일을 맞춰 특정 변수가 과도한 영향을 주지 않도록 합니다.',2),
('modeling',null,'AI 모델링 개요','전처리가 끝난 데이터로 실제 예측 모델을 학습시키는 단계입니다. 문제가 분류인지 회귀인지 먼저 판단하고, 목표(종속)변수와 입력 변수를 지정한 뒤 머신러닝 또는 딥러닝 모델을 학습합니다.',0),
('modeling','문제 유형 판단','문제 유형 판단','예측하려는 목표변수가 범주형(예/아니오, 등급 등)이면 분류모형, 연속적인 숫자값(금액, 수량 등)이면 회귀모형을 선택합니다. 시계열·군집 모형은 이 과정과 목적이 다르므로 문제 조건을 먼저 확인하세요.',1),
('modeling','머신러닝','머신러닝','KNN, Decision Tree, Random Forest 등은 각기 다른 방식으로 데이터를 학습합니다. 모델마다 학습 속도와 해석 난이도가 다르니, AIDU에서 여러 모델을 함께 학습해 성능을 비교해 보는 것이 좋습니다.',2),
('evaluation',null,'모델 성능평가 개요','학습이 끝난 모델이 실제로 얼마나 잘 예측하는지 확인하고, 어떤 변수가 예측에 큰 영향을 주는지 해석하는 단계입니다. 지표 하나만 보지 말고 상황에 맞는 지표를 선택하는 것이 중요합니다.',0),
('evaluation','모델 평가 지표','모델 평가 지표','분류모형은 Accuracy(정확도)·Precision(정밀도)·Recall(재현율)·F1 score를, 회귀모형은 R²(설명력)·MAE·MSE를 주로 사용합니다. 데이터가 불균형할 때는 Accuracy만으로 성능을 판단하면 오해할 수 있습니다.',1),
('evaluation','변수 영향도','변수 영향도','모델이 예측할 때 어떤 변수를 얼마나 중요하게 반영했는지 보여주는 지표입니다. 영향도 순위가 높다고 항상 좋은 변수는 아니며, 실제 의미와 함께 해석해야 합니다.',2);
