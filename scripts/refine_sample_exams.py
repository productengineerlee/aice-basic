import json
from pathlib import Path
from extract_sample_exams import ROOT, OUT, SECTION_META, allocate_scores, build_sql, one_line

def refine(prompt):
    p=one_line(prompt).lower()
    if any(x in p for x in ["변수 영향도","영향을 주","시뮬레이션","활용하여 다음과 같은 조건","고도화","성능을 개선","과적합","드롭아웃을 0.5"]):
        tags=[]
        if "영향" in p: tags.append("변수 영향도")
        if "시뮬레이션" in p or "조건일 때" in p or "활용하여 다음과 같은 조건" in p: tags.append("예측 시뮬레이션")
        if "고도화" in p or "개선" in p or "과적합" in p: tags.append("성능 개선")
        return "evaluation",tags or ["모델 활용"]
    if any(x in p for x in ["머신러닝 모델","딥러닝 모델","ml 모델","학습 유형","알고리즘의 유형","종속변수를 고르"]):
        tags=[]
        if "알고리즘의 유형" in p: tags.append("문제 유형 판단")
        if "머신러닝" in p or "ml 모델" in p: tags.append("머신러닝")
        if "딥러닝" in p: tags.append("딥러닝")
        has_metric=any(x in p for x in ["accuracy","precision","recall","f1 score","r2","mae","mse","설명력","재현율"])
        if has_metric:
            tags.append("모델 평가 지표")
            return "evaluation",tags
        return "modeling",tags or ["모델 설정"]
    if any(x in p for x in ["대체하시오","결측값 처리","데이터 가공 후","인코딩하시오","정규화하시오","스케일링하시오"]):
        return "preprocessing",["결측치 처리"] if "결측" in p else ["데이터 가공"]
    tags=[]
    for key,label in [("결측치","결측치 탐색"),("기술통계","기초통계"),("표준편차","기초통계"),("중앙값","기초통계"),("최빈값","기초통계"),("상관관계","상관관계"),("히트맵","히트맵"),("박스차트","박스차트"),("iqr","이상치"),("이상치","이상치"),("시각화","시각화"),("분포","분포차트"),("변수의 유형","데이터 유형")]:
        if key in p and label not in tags:tags.append(label)
    return "eda",tags or ["데이터 이해"]

data=json.loads((OUT/"sample-exams.json").read_text(encoding="utf-8"))
for e in data["exams"]:
    for q in e["questions"]:q["section"],q["competency_tags"]=refine(q["prompt"])
    allocate_scores(e)
(OUT/"sample-exams.json").write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
(ROOT/"supabase"/"seed_sample_exams.sql").write_text(build_sql(data["exams"]),encoding="utf-8")
report={"exam_count":len(data["exams"]),"question_count":sum(len(e["questions"]) for e in data["exams"]),"exams":[]}
for e in data["exams"]:
    report["exams"].append({"slug":e["slug"],"questions":len(e["questions"]),"choice_questions":sum(bool(q["choices"]) for q in e["questions"]),"missing_choice_answers":[q["number"] for q in e["questions"] if q["choices"] and not q["answer"]["choice_label"]],"score_total":round(sum(q["score"] for q in e["questions"]),2),"sections":{k:sum(q["section"]==k for q in e["questions"]) for k in SECTION_META}})
(OUT/"validation-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(report,ensure_ascii=False,indent=2))
