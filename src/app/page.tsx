import { ArrowRight, BarChart3, CheckCircle2, Clock3, Database, ShieldCheck, Zap } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

const features = [
  { icon: Database, title: "AIDU 실전형 문제", text: "실습 데이터를 내려받아 AIDU에서 직접 분석하고 결과를 답안에 입력합니다." },
  { icon: Clock3, title: "60분 실전 모드", text: "실제 시험과 같은 제한시간, 자동저장, 답안 검토 기능으로 시간 감각을 익힙니다." },
  { icon: BarChart3, title: "영역별 학습진단", text: "총점뿐 아니라 탐색적 데이터 분석·데이터 전처리·AI 모델링·모델 성능평가의 취약점을 확인합니다." },
  { icon: Zap, title: "무료로 바로 시작", text: "회원가입 후 즉시 모의고사를 이용할 수 있으며, 답안은 자동저장되고 제출 즉시 채점 결과를 확인할 수 있습니다." },
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
      {/* ── HEADER ── */}
      <header className="site-header">
        <a className="brand" href="/">
          <Image src="/logo-mark.png" alt="AICE LAB" width={32} height={32} className="brand-mark" priority />
          <span>AICE <b>LAB</b></span>
        </a>
        <nav>
          <a href="#exams">샘플모의고사</a>
          <a href="#" className="nav-disabled">실전모의고사<span className="nav-soon">준비중</span></a>
          <a href="#">AIDU설치</a>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <a className="text-button" href="/mypage">학습 분석</a>
              <a className="primary small" href="/dashboard">내 대시보드</a>
            </>
          ) : (
            <>
              <a className="text-button" href="/auth/login">로그인</a>
              <a className="primary small" href="/auth/signup">무료로 시작하기</a>
            </>
          )}
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="hero hero-center">
        <div className="eyebrow">AICE BASIC 합격을 위한 실전 연습</div>
        <h1>AIDU로 직접 풀고,<br /><em>실력은 데이터로 확인하세요.</em></h1>
        <div className="hero-actions">
          <a className="primary btn-lg" href={user ? "/exams" : "/auth/signup"}>
            {user ? "모의고사 선택하기" : "샘플문항 시작하기"} <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* ── STATS STRIP ── same child structure as original */}
      <section id="about" className="exam-facts">
        <div><b>15</b><span>문항</span></div>
        <div><b>60</b><span>분</span></div>
        <div><b>80</b><span>점 이상 합격</span></div>
        <div><b>100%</b><span>노코딩 실기</span></div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="section">
        <div className="section-heading">
          <h2>시험 준비에 필요한 모든 과정을<br />하나의 흐름으로 연결했습니다.</h2>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, text }, i) => (
            <article className="feature-card" key={title}>
              <div className="feature-icon"><Icon size={22} /></div>
              <span className="feature-num">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              {i === 0 && (
                <div className="feature-preview">
                  <Image
                    src="/aidu-preview.png"
                    alt="AIDU 실전형 문제 화면 예시"
                    width={320}
                    height={200}
                    className="feature-preview-img"
                  />
                </div>
              )}
              {i === 2 && (
                <div className="feature-preview">
                  <Image
                    src="/score-preview.png"
                    alt="영역별 학습진단 화면 예시"
                    width={320}
                    height={200}
                    className="feature-preview-img"
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* ── EXAMS ── */}
      <section id="exams" className="section exam-section">
        <div className="section-heading">
          <h2>샘플 모의고사</h2>
          <p>분류와 회귀 유형을 골고루 연습해 보세요.</p>
        </div>
        <div className="exam-grid">
          {exams.map((exam, i) => (
            <article className="exam-card" key={exam.title}>
              <div className="exam-top">
                <span className={`tag ${exam.color}`}>{exam.type}</span>
                <span className="exam-num">모의고사 0{i + 1}</span>
              </div>
              <h3>{exam.title}</h3>
              <div className="exam-meta">
                <span><Clock3 size={13} />60분</span>
                <span><ShieldCheck size={13} />{exam.questions}문항</span>
              </div>
              <a className="exam-card-btn" href={user ? "/exams" : "/auth/signup"}>시험 정보 보기 <ArrowRight size={14} /></a>
            </article>
          ))}
        </div>
        <div className="notice">
          <ShieldCheck size={16} />
          <div>
            <b>안내</b>
            <p>본 서비스는 AICE 공식 시험 사이트가 아닌 학습용 모의고사 서비스입니다. 표시되는 합격 여부는 모의고사 기준입니다.</p>
          </div>
        </div>
      </section>

      {/* ── COMING SOON ── */}
      <section className="section coming-soon-section">
        <div className="coming-soon-inner">
          <span className="coming-soon-badge">준비중</span>
          <h2>실전 모의고사</h2>
          <p>더 다양한 유형의 실전 모의고사가 곧 추가될 예정입니다.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-inner">
          <div className="brand">
            <span>AICE <b>LAB</b></span>
          </div>
          <p>AIDU 실습과 함께 준비하는 AICE BASIC 모의고사</p>
          <span>© 2026 AICE LAB. Learning service.</span>
        </div>
      </footer>
    </main>
  );
}
