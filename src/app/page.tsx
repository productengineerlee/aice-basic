import { ArrowRight, BarChart3, BrainCircuit, CheckCircle2, Clock3, Database, Download, ShieldCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

const features = [
  { icon: Database, title: "AIDU 실전형 문제", text: "실습 데이터를 내려받아 AIDU에서 직접 분석하고 결과를 답안에 입력합니다." },
  { icon: Clock3, title: "60분 실전 모드", text: "실제 시험과 같은 제한시간, 자동저장, 답안 검토 기능으로 시간 감각을 익힙니다." },
  { icon: BarChart3, title: "영역별 학습진단", text: "총점뿐 아니라 데이터 분석·전처리·모델링·성능평가의 취약점을 확인합니다." },
];

const exams = [
  { type: "분류", title: "고객별 콘텐츠 취향 예측", questions: 12, color: "blue" },
  { type: "분류", title: "호러 장르 선호도 분석", questions: 15, color: "blue" },
  { type: "회귀", title: "통신 이용요금 예측", questions: 11, color: "violet" },
];

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();


  return (
    <main>
      <header className="site-header">
        <a className="brand" href="/"><span className="brand-mark"><BrainCircuit size={22} /></span><span>AICE <b>LAB</b></span></a>
        <nav><a href="#about">시험 안내</a><a href="#exams">모의고사</a><a href="#features">학습 분석</a></nav>
        <div className="header-actions">{user ? <><a className="text-button" href="/mypage">학습 분석</a><a className="primary small" href="/dashboard">내 대시보드</a></> : <><a className="text-button" href="/auth/login">로그인</a><a className="primary small" href="/auth/signup">무료로 시작하기</a></>}</div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span></span>AICE BASIC 합격을 위한 실전 연습</div>
          <h1>AIDU로 직접 풀고,<br/><em>실력은 데이터로 확인하세요.</em></h1>
          <p>AICE BASIC 시험과 유사한 환경에서 데이터 분석부터 AI 모델링까지 연습하고, 제출 즉시 영역별 점수와 맞춤 학습진단을 받아보세요.</p>
          <div className="hero-actions"><a className="primary" href={user ? "/exams" : "/auth/signup"}>{user ? "모의고사 선택하기" : "모의고사 시작하기"} <ArrowRight size={18}/></a><button className="secondary"><Download size={18}/> AIDU 설치 안내</button></div>
          <div className="trust"><span><CheckCircle2/>회원가입 후 무료 이용</span><span><CheckCircle2/>답안 자동저장</span><span><CheckCircle2/>즉시 채점</span></div>
        </div>
        <div className="score-card">
          <div className="score-head"><div><span>최근 모의고사</span><b>분류 실전 모의고사 01</b></div><span className="pass">합격</span></div>
          <div className="score-main"><div className="ring"><span><b>86</b><small>/ 100</small></span></div><div className="score-summary"><span>합격 기준 80점</span><strong>안정적인 합격권이에요!</strong><p>모델 성능평가 영역을 조금 더 보강하면 고득점을 기대할 수 있어요.</p></div></div>
          <div className="bars">
            {[['탐색적 데이터 분석',27,30],['데이터 전처리',26,30],['AI 모델링',16,16],['모델 성능평가',17,24]].map(([label,score,total])=><div className="bar-row" key={label}><span>{label}</span><div><i style={{width:`${Number(score)/Number(total)*100}%`}}></i></div><b>{score}<small>/{total}</small></b></div>)}
          </div>
        </div>
      </section>

      <section id="about" className="exam-facts"><div><b>15</b><span>문항</span></div><div><b>60</b><span>분</span></div><div><b>80</b><span>점 이상 합격</span></div><div><b>100%</b><span>노코딩 실기</span></div></section>

      <section id="features" className="section"><div className="section-heading"><span>WHY AICE LAB</span><h2>시험 준비에 필요한 모든 과정을<br/>하나의 흐름으로 연결했습니다.</h2></div><div className="feature-grid">{features.map(({icon:Icon,title,text},i)=><article key={title}><div className="feature-icon"><Icon/></div><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>

      <section id="exams" className="section exam-section"><div className="section-heading left"><span>MOCK EXAMS</span><h2>샘플 모의고사</h2><p>분류와 회귀 유형을 골고루 연습해 보세요.</p></div><div className="exam-grid">{exams.map((exam,i)=><article className="exam-card" key={exam.title}><div className="exam-top"><span className={`tag ${exam.color}`}>{exam.type}</span><span>모의고사 0{i+1}</span></div><h3>{exam.title}</h3><div className="exam-meta"><span><Clock3/>60분</span><span><ShieldCheck/>{exam.questions}문항</span></div><button>시험 정보 보기 <ArrowRight/></button></article>)}</div>
        <div className="notice"><ShieldCheck/><div><b>안내</b><p>본 서비스는 AICE 공식 시험 사이트가 아닌 학습용 모의고사 서비스입니다. 표시되는 합격 여부는 모의고사 기준입니다.</p></div></div>
      </section>

      <footer><div className="brand"><span className="brand-mark"><BrainCircuit size={20}/></span><span>AICE <b>LAB</b></span></div><p>AIDU 실습과 함께 준비하는 AICE BASIC 모의고사</p><span>© 2026 AICE LAB. Learning service.</span></footer>
    </main>
  );
}
