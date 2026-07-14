import { ResultView } from "@/components/exams/result-view";
import "./result.css";
export default async function ResultPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <ResultView slug={slug}/>}
