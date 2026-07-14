export function LoadingScreen({ label = "화면을 준비하고 있습니다" }: { label?: string }) {
  return <main className="system-state loading-state" aria-live="polite" aria-busy="true"><div className="state-spinner" /><span>PLEASE WAIT</span><h1>{label}</h1><p>Supabase에서 최신 정보를 안전하게 불러오는 중입니다.</p><div className="state-skeleton"><i /><i /><i /></div></main>;
}
