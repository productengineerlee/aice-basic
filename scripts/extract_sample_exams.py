from __future__ import annotations

import json, re, uuid
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "sample-exams"
NS = uuid.UUID("b1bbfb0c-c2a8-4d8e-a3e7-56c1bd35b7f4")

SECTION_META = {
    "eda": ("탐색적 데이터 분석", 30),
    "preprocessing": ("데이터 전처리", 30),
    "modeling": ("AI 모델링", 16),
    "evaluation": ("모델 성능평가", 24),
}

def clean(text: str) -> str:
    text = text.replace("\u00a0", " ").replace("T ree", "Tree").replace("F orest", "Forest").replace("K Nearest", "K-Nearest")
    text = re.sub(r"페이지\s*\d+\s*/\s*\d+", "", text)
    text = re.sub(r"(?<=\w)\n(?=\w)", " ", text)
    return re.sub(r"[ \t]+", " ", text).strip()

def one_line(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()

def classify(prompt: str) -> tuple[str, list[str]]:
    p = one_line(prompt).lower()
    if any(x in p for x in ["결측치", "결측값", "데이터 가공", "인코더", "정규화", "스케일링"]):
        tags = ["결측치 처리"] if "결측" in p else ["데이터 가공"]
        if "인코더" in p or "인코딩" in p: tags.append("인코딩")
        return "preprocessing", tags
    if any(x in p for x in ["변수 영향도", "영향을 주는", "시뮬레이션", "고도화", "성능을 개선", "과적합", "드롭아웃을 0.5"]):
        tags=[]
        if "영향" in p: tags.append("변수 영향도")
        if "시뮬레이션" in p or "조건일 때" in p: tags.append("예측 시뮬레이션")
        if "고도화" in p or "개선" in p or "과적합" in p: tags.append("성능 개선")
        return "evaluation", tags or ["모델 활용"]
    if any(x in p for x in ["머신러닝 모델", "딥러닝 모델", "ml 모델", "학습 유형", "알고리즘의 유형", "종속변수를 고르"]):
        tags=[]
        if "알고리즘의 유형" in p: tags.append("문제 유형 판단")
        if "머신러닝" in p or "ml 모델" in p: tags.append("머신러닝")
        if "딥러닝" in p: tags.append("딥러닝")
        for metric in ["accuracy","precision","recall","f1 score","r2","mae","mse","설명력","재현율"]:
            if metric in p: tags.append("모델 평가 지표")
        return "modeling", tags or ["모델 설정"]
    tags=[]
    for key,label in [("기술통계","기초통계"),("표준편차","기초통계"),("중앙값","기초통계"),("최빈값","기초통계"),("상관관계","상관관계"),("히트맵","히트맵"),("박스차트","박스차트"),("iqr","이상치"),("이상치","이상치"),("시각화","시각화"),("분포","분포차트"),("변수의 유형","데이터 유형")]:
        if key in p and label not in tags: tags.append(label)
    return "eda", tags or ["데이터 이해"]

def answer_type(prompt: str, choices: list[dict]) -> tuple[str,str,int|None,float|None]:
    if choices: return "single_choice", "exact", None, None
    p=one_line(prompt).lower()
    if "%" in p or "비율" in p: return "percentage", "rounded", 2, 0.01
    if "소수점" in p or any(x in p for x in ["accuracy","precision","recall","mse","mae","r2"]):
        m=re.search(r"소수점\s*(?:제)?(\S+?)\s*자리",p)
        return "decimal", "absolute_tolerance", 4, 0.0005
    if re.search(r"\d+(?:\.\d+)?k\s*형식",p,re.I): return "unit_value", "exact", None, None
    return "integer", "exact", None, None

def parse_choices(prompt: str) -> list[dict]:
    found=[]
    matches=list(re.finditer(r"(?:^|\n)\s*\((\d+)\)\s*([^\n]+)",prompt))
    for m in matches:
        content=one_line(m.group(2))
        if content and len(content)<220:
            found.append({"label":m.group(1),"content":content})
    return found

def parse_pdf(pdf: Path, index: int) -> dict:
    raw="\n".join(page.extract_text() or "" for page in PdfReader(str(pdf)).pages)
    text=clean(raw)
    markers=list(re.finditer(r"\[(?:문제|문항)\s*(\d+)\]",text))
    if not markers: raise ValueError(f"No questions: {pdf}")
    intro=text[:markers[0].start()]
    title_match=re.search(r"\[(?:문제\s*)?(분류|회귀)\s*#?\s*\d+\]\s*:\s*(.+)",intro)
    kind="classification" if "분류" in pdf.name or "분류" in str(pdf.parent) else "regression"
    title=one_line(title_match.group(2)) if title_match else ("분류" if kind=="classification" else "회귀")+f" 샘플 모의고사 {index}"
    dataset=next((p.name for p in pdf.parent.iterdir() if p.suffix.lower()==".csv"),"")
    questions=[]
    for i,m in enumerate(markers):
        end=markers[i+1].start() if i+1<len(markers) else len(text)
        block=text[m.end():end].strip()
        ans_m=re.search(r"\(정답\)\s*(.*?)(?=\(해설\)|\n\s*AI모델|\Z)",block,re.S)
        if not ans_m: raise ValueError(f"Missing answer Q{m.group(1)}: {pdf}")
        prompt=block[:ans_m.start()].strip()
        answer=one_line(ans_m.group(1))
        exp_start=re.search(r"\(해설\)",block)
        explanation=one_line(block[exp_start.end():] if exp_start else block[ans_m.end():])
        choices=parse_choices(prompt)
        section,tags=classify(prompt)
        qtype,grading,places,tolerance=answer_type(prompt,choices)
        answer_label=None
        if choices:
            am=re.search(r"\((\d+)\)",answer)
            answer_label=am.group(1) if am else next((c["label"] for c in choices if c["content"].lower() in answer.lower()),None)
        correct_value=None if choices else answer
        questions.append({
            "number":int(m.group(1)),"type":qtype,"section":section,"competency_tags":tags,
            "prompt":one_line(prompt),"choices":choices,"answer":{"raw":answer,"choice_label":answer_label,"value":correct_value,"grading_type":grading,"decimal_places":places,"tolerance":tolerance},
            "explanation":explanation,"score":None,"difficulty":2,
        })
    return {"slug":f"sample-{kind}-{index}","title":title,"kind":kind,"source_pdf":str(pdf.relative_to(ROOT)),"dataset":dataset,"duration_minutes":60,"passing_score":80,"questions":questions}

def allocate_scores(exam: dict) -> None:
    # Preserve a 100-point total while weighting official sections 30/30/16/24.
    by={k:[] for k in SECTION_META}
    for q in exam["questions"]: by[q["section"]].append(q)
    active=[k for k,v in by.items() if v]
    weights={k:SECTION_META[k][1] for k in active}; total=sum(weights.values())
    remaining=100.0
    for si,k in enumerate(active):
        section_total=round(100*weights[k]/total,2) if si<len(active)-1 else remaining
        qs=by[k]; base=round(section_total/len(qs),2)
        used=0.0
        for qi,q in enumerate(qs):
            score=base if qi<len(qs)-1 else round(section_total-used,2)
            q["score"]=score; used=round(used+score,2)
        remaining=round(remaining-section_total,2)

def sql_quote(v: str|None) -> str:
    if v is None:return "null"
    return "'"+v.replace("'","''")+"'"

def build_sql(exams:list[dict]) -> str:
    out=["-- Generated from the six provided AICE BASIC sample explanation PDFs.","begin;"]
    for e in exams:
        eid=str(uuid.uuid5(NS,e["slug"])); e["id"]=eid
        out.append(f"insert into public.exams(id,slug,title,description,kind,status,duration_minutes,passing_score,total_score,fixed_order,published_at) values('{eid}',{sql_quote(e['slug'])},{sql_quote(e['title'])},{sql_quote('제공된 공식 샘플 자료를 구조화한 학습용 모의고사')},{sql_quote(e['kind'])},'published',60,80,100,true,now()) on conflict(slug) do update set title=excluded.title;")
        section_ids={}
        for order,(code,(title,_)) in enumerate(SECTION_META.items(),1):
            qs=[q for q in e["questions"] if q["section"]==code]
            if not qs: continue
            sid=str(uuid.uuid5(NS,f"{e['slug']}:section:{code}"));section_ids[code]=sid
            maximum=sum(float(q["score"]) for q in qs)
            out.append(f"insert into public.exam_sections(id,exam_id,code,title,max_score,sort_order) values('{sid}','{eid}',{sql_quote(code)},{sql_quote(title)},{maximum:.2f},{order}) on conflict(exam_id,code) do update set max_score=excluded.max_score;")
        for q in e["questions"]:
            qid=str(uuid.uuid5(NS,f"{e['slug']}:q:{q['number']}")); q["id"]=qid
            tags="array["+",".join(sql_quote(x) for x in q["competency_tags"])+"]::text[]"
            out.append(f"insert into public.questions(id,exam_id,section_id,number,type,prompt,score,difficulty,competency_tags,explanation,is_active) values('{qid}','{eid}','{section_ids[q['section']]}',{q['number']},{sql_quote(q['type'])},{sql_quote(q['prompt'])},{q['score']},2,{tags},{sql_quote(q['explanation'])},true) on conflict(exam_id,number) do update set prompt=excluded.prompt,explanation=excluded.explanation;")
            choice_ids={}
            for order,c in enumerate(q["choices"],1):
                cid=str(uuid.uuid5(NS,f"{qid}:choice:{c['label']}"));choice_ids[c["label"]]=cid;c["id"]=cid
                out.append(f"insert into public.question_choices(id,question_id,label,content,sort_order) values('{cid}','{qid}',{sql_quote(c['label'])},{sql_quote(c['content'])},{order}) on conflict(question_id,label) do update set content=excluded.content;")
            a=q["answer"]
            correct_choice=sql_quote(choice_ids.get(a["choice_label"]))
            val=sql_quote(a["value"])
            places="null" if a["decimal_places"] is None else str(a["decimal_places"])
            tol="null" if a["tolerance"] is None else str(a["tolerance"])
            out.append(f"insert into public.answer_keys(question_id,grading_type,correct_choice_id,correct_value,decimal_places,tolerance) values('{qid}',{sql_quote(a['grading_type'])},{correct_choice},{val},{places},{tol}) on conflict(question_id) do update set grading_type=excluded.grading_type,correct_choice_id=excluded.correct_choice_id,correct_value=excluded.correct_value,decimal_places=excluded.decimal_places,tolerance=excluded.tolerance;")
    out.extend(["commit;",""])
    return "\n".join(out)

def main():
    pdfs=sorted(ROOT.rglob("*해설*.pdf"),key=lambda p:str(p))
    if len(pdfs)!=6: raise SystemExit(f"Expected 6 explanation PDFs, found {len(pdfs)}")
    counters={"classification":0,"regression":0}; exams=[]
    for pdf in pdfs:
        kind="classification" if "분류" in str(pdf) else "regression";counters[kind]+=1
        e=parse_pdf(pdf,counters[kind]);allocate_scores(e);exams.append(e)
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/"sample-exams.json").write_text(json.dumps({"version":"1.0","exams":exams},ensure_ascii=False,indent=2),encoding="utf-8")
    (ROOT/"supabase"/"seed_sample_exams.sql").write_text(build_sql(exams),encoding="utf-8")
    report={"exam_count":len(exams),"question_count":sum(len(e["questions"]) for e in exams),"exams":[]}
    for e in exams:
        report["exams"].append({"slug":e["slug"],"questions":len(e["questions"]),"choice_questions":sum(bool(q["choices"]) for q in e["questions"]),"missing_choice_answers":[q["number"] for q in e["questions"] if q["choices"] and not q["answer"]["choice_label"]],"score_total":round(sum(q["score"] for q in e["questions"]),2),"sections":{k:sum(q["section"]==k for q in e["questions"]) for k in SECTION_META}})
    (OUT/"validation-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=="__main__":main()
