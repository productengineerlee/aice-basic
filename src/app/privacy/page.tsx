import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import "../exams/exams.css";

export default function PrivacyPage() {
  return <main className="exam-app"><div className="guide-shell">
    <Link className="guide-back" href="/"><ArrowLeft size={15} />홈으로</Link>
    <div className="guide-card">
      <div className="guide-hero">
        <h1>개인정보 처리방침</h1>
        <p className="legal-updated">시행일: 2026년 8월 30일</p>
      </div>
      <div className="guide-body">
        <section className="guide-section">
          <p>AICE LAB(이하 &ldquo;회사&rdquo;)는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련 법령을 준수합니다. 회사는 본 개인정보 처리방침을 통해 이용자가 제공하는 개인정보가 어떠한 목적과 방식으로 이용되고 있으며, 개인정보 보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.</p>
        </section>

        <section className="guide-section">
          <h2>1. 수집하는 개인정보의 항목 및 수집방법</h2>
          <p>① 회사는 회원가입 시 다음 정보를 수집합니다.</p>
          <ul>
            <li><b>필수 항목</b>: 이메일 주소, 비밀번호(암호화 저장)</li>
          </ul>
          <p>② 서비스 이용 과정에서 다음 정보가 자동으로 생성·수집될 수 있습니다.</p>
          <ul>
            <li>모의고사·문제풀이 응시 기록, 제출 답안, 채점 결과, 학습 통계</li>
            <li>서비스 이용기록, 접속 로그, 접속 IP, 쿠키, 기기정보</li>
          </ul>
          <p>③ 수집방법: 회원가입 및 서비스 이용 과정에서 이용자가 직접 입력하거나, 서비스 이용 중 자동으로 생성되어 수집됩니다.</p>
        </section>

        <section className="guide-section">
          <h2>2. 개인정보의 수집 및 이용목적</h2>
          <ul>
            <li>회원 식별 및 로그인, 부정이용 방지 등 회원관리</li>
            <li>모의고사·자격증 문제풀이 서비스 제공, 자동 채점 및 결과 리포트 제공</li>
            <li>영역별·출제범위별 학습 진단, 통계 및 취약영역 맞춤 콘텐츠 제공</li>
            <li>서비스 개선을 위한 통계 분석 및 신규 서비스 개발</li>
            <li>공지사항 전달 등 고객 문의 응대</li>
          </ul>
        </section>

        <section className="guide-section">
          <h2>3. 개인정보의 보유 및 이용기간</h2>
          <p>회사는 원칙적으로 개인정보 수집·이용 목적이 달성된 후, 또는 회원이 탈퇴를 요청한 경우 지체 없이 해당 정보를 파기합니다. 다만 관계 법령의 규정에 의하여 보존할 필요가 있는 경우 회사는 관계 법령에서 정한 일정한 기간 동안 회원정보를 보관합니다.</p>
          <ul>
            <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
            <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
            <li>서비스 이용 관련 접속 기록: 3개월 (통신비밀보호법)</li>
          </ul>
        </section>

        <section className="guide-section">
          <h2>4. 개인정보의 제3자 제공</h2>
          <p>회사는 이용자의 개인정보를 제2조에서 명시한 범위 내에서만 처리하며, 이용자의 사전 동의 없이는 본래의 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다. 다만 법령에 특별한 규정이 있거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우는 예외로 합니다.</p>
        </section>

        <section className="guide-section">
          <h2>5. 개인정보 처리의 위탁</h2>
          <p>회사는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리업무를 위탁하고 있으며, 관계 법령에 따라 위탁계약 시 개인정보가 안전하게 관리될 수 있도록 필요한 사항을 규정하고 있습니다.</p>
          <ul>
            <li>Supabase, Inc. — 회원 인증, 데이터베이스 및 파일 저장소 운영</li>
            <li>Vercel Inc. — 서비스 웹 호스팅 및 배포 인프라 운영</li>
          </ul>
        </section>

        <section className="guide-section">
          <h2>6. 정보주체의 권리·의무 및 행사방법</h2>
          <p>이용자는 언제든지 등록되어 있는 본인의 개인정보를 조회, 수정할 수 있으며, 회원 탈퇴를 통해 개인정보의 삭제(처리정지)를 요청할 수 있습니다. 권리 행사는 마이페이지 또는 아래 개인정보 보호책임자 연락처를 통해 서면, 전자우편으로 하실 수 있으며, 회사는 이에 대해 지체 없이 조치합니다.</p>
        </section>

        <section className="guide-section">
          <h2>7. 개인정보의 파기</h2>
          <p>회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다. 전자적 파일 형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제합니다.</p>
        </section>

        <section className="guide-section">
          <h2>8. 개인정보의 안전성 확보조치</h2>
          <ul>
            <li>비밀번호는 암호화하여 저장·관리하고 있습니다.</li>
            <li>개인정보에 대한 접근권한을 최소한의 인원으로 제한하고 있습니다.</li>
            <li>개인정보 처리시스템에 대한 접속기록을 보관·점검하고 있습니다.</li>
          </ul>
        </section>

        <section className="guide-section">
          <h2>9. 개인정보 보호책임자</h2>
          <p>회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
          <ul>
            <li>담당자: 고태수</li>
            <li>이메일: gtsu0707@gmail.com</li>
          </ul>
        </section>

        <section className="guide-section">
          <h2>10. 고지의 의무</h2>
          <p>이 개인정보 처리방침은 법령 및 서비스 변경사항을 반영하기 위해 개정될 수 있으며, 변경되는 경우 서비스 내 공지사항을 통해 시행 최소 7일 전에 고지합니다.</p>
        </section>
      </div>
    </div>
  </div></main>;
}
