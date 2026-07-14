import json,re
from pathlib import Path
from extract_sample_exams import ROOT,OUT,SECTION_META,build_sql

data=json.loads((OUT/"sample-exams.json").read_text(encoding="utf-8"))
corrections={
 ("sample-classification-1",11):("choice_label","1","원문 정답 번호 (2)와 정답 문구 Y가 불일치하여 문구 기준으로 교정"),
 ("sample-classification-3",12):("choice_label","3","원문 정답 번호 (2)와 총 콘텐츠 구매금액 보기가 불일치하여 문구 기준으로 교정"),
 ("sample-classification-3",14):("choice_label","2","원문 정답 번호 (1)과 KNN 보기가 불일치하여 문구 기준으로 교정"),
}
applied=[]
for e in data["exams"]:
 for q in e["questions"]:
  key=(e["slug"],q["number"])
  if key in corrections:
   field,value,reason=corrections[key];q["answer"][field]=value;applied.append({"exam":key[0],"question":key[1],"reason":reason})
  if not q["choices"]:
   value=(q["answer"]["value"] or "").strip()
   if value.lower().endswith("k"):
    q["type"]="unit_value";q["answer"]["grading_type"]="exact";q["answer"]["decimal_places"]=None;q["answer"]["tolerance"]=None
   elif re.fullmatch(r"[-+]?\d+\.\d+",value) and q["type"]=="integer":
    decimals=len(value.split(".")[1]);q["type"]="decimal";q["answer"]["grading_type"]="rounded";q["answer"]["decimal_places"]=decimals;q["answer"]["tolerance"]=0.5*(10**-decimals)
  if e["slug"]=="sample-classification-2" and q["number"]==3 and not q["explanation"]:
   q["explanation"]="AIDU의 데이터 분석-기초정보분석에서 전체 데이터 범위를 선택한 후 총 콘텐츠 구매건수(total_buy_ol)의 표준편차(sd) 3.13을 확인할 수 있습니다."
   applied.append({"exam":e["slug"],"question":3,"reason":"PDF 텍스트에 해설 표식이 없어 해설 내용 보완"})

(OUT/"sample-exams.json").write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
(ROOT/"supabase"/"seed_sample_exams.sql").write_text(build_sql(data["exams"]),encoding="utf-8")
report={"exam_count":len(data["exams"]),"question_count":sum(len(e["questions"]) for e in data["exams"]),"source_corrections":applied,"exams":[]}
for e in data["exams"]:
 report["exams"].append({"slug":e["slug"],"questions":len(e["questions"]),"choice_questions":sum(bool(q["choices"]) for q in e["questions"]),"missing_choice_answers":[q["number"] for q in e["questions"] if q["choices"] and not q["answer"]["choice_label"]],"missing_explanations":[q["number"] for q in e["questions"] if not q["explanation"]],"score_total":round(sum(q["score"] for q in e["questions"]),2),"sections":{k:sum(q["section"]==k for q in e["questions"]) for k in SECTION_META}})
(OUT/"validation-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(report,ensure_ascii=False,indent=2))
