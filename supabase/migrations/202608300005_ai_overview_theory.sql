-- "AI 개요" 콘텐츠는 채점 영역(exam_sections)과 무관한 리터러시 보충 자료라
-- section_code='ai_overview'로 theory_content에만 존재하고 exam_sections에는 행을 추가하지 않는다.
-- 섹션 제목/정렬순서는 src/lib/theory.ts의 EXTRA_THEORY_SECTIONS 상수에서 관리한다.
insert into public.theory_content(section_code,competency_tag,title,body,sort_order) values
('ai_overview',null,'AI 개요','이 영역은 시험 채점 범위에 포함되지 않지만, AI를 이해하는 데 도움이 되는 배경 지식을 다룹니다. 역사·기본 개념부터 가볍게 살펴보세요.',0),
('ai_overview','AI의 역사','AI의 역사','인공지능이라는 용어는 1956년 다트머스 회의에서 처음 제안되었습니다. 이후 두 차례의 "AI 겨울"(연구·투자가 침체된 시기)을 거쳐, 2010년대 딥러닝의 성공과 대규모 데이터·연산 자원의 발전으로 다시 크게 발전했습니다.',1),
('ai_overview','약한 AI와 강한 AI','약한 AI와 강한 AI','약한 AI(Narrow AI)는 특정 작업(이미지 분류, 번역 등)에 특화된 AI로, 현재 우리가 사용하는 대부분의 AI가 여기에 속합니다. 강한 AI(General AI)는 인간처럼 모든 영역에서 스스로 사고하고 학습하는 AI를 뜻하며, 아직 실현되지 않은 개념입니다.',2),
('ai_overview','머신러닝과 딥러닝','머신러닝과 딥러닝','머신러닝은 데이터에서 규칙을 스스로 학습하는 방법론 전체를 가리킵니다. 딥러닝은 인공신경망을 여러 층으로 쌓아 복잡한 패턴을 학습하는 머신러닝의 한 갈래로, 이미지·음성·자연어처럼 비정형 데이터에서 특히 강점을 보입니다.',3),
('ai_overview','생성형 AI','생성형 AI','생성형 AI(Generative AI)는 텍스트·이미지·코드처럼 새로운 콘텐츠를 만들어내는 AI를 말합니다. ChatGPT 같은 대규모 언어모델(LLM)이 대표적이며, 방대한 데이터를 학습해 다음에 올 확률이 높은 단어나 픽셀을 예측하는 방식으로 동작합니다.',4);
