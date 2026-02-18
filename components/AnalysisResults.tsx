import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, CVData, DimensionScores } from '../types';
import { generateTailoredCV } from '../services/geminiService';
import { generateCvPdf } from '../services/pdfService';
import { Loader2, Download, FileText, Briefcase, DollarSign, Sun, Target, Shield, CheckCircle2, Zap, AlertOctagon } from 'lucide-react';

interface AnalysisResultsProps {
  result: AnalysisResult;
}

// Componente simples de Barra de Progresso para Dimensões
const DimensionBar: React.FC<{ label: string, score: number }> = ({ label, score }) => {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
        <span>{label}</span>
        <span className={score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400'}>{score}%</span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${score}%` }}></div>
      </div>
    </div>
  );
};

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ result }) => {
  const [tailoredCV, setTailoredCV] = useState<CVData | null>(null);
  const [isGeneratingCV, setIsGeneratingCV] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const cvSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tailoredCV && cvSectionRef.current) {
      setTimeout(() => {
        cvSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [tailoredCV]);

  const handleGenerateCV = async () => {
    if (isGeneratingCV) return;
    setIsGeneratingCV(true);
    setTailoredCV(null);
    try {
      const profile = localStorage.getItem('hunter_match_profile') || "";
      if (!profile || profile.length < 50) {
        alert("⚠️ Seu Perfil Mestre parece muito curto.");
      }
      const cvData = await generateTailoredCV(result, profile);
      setTailoredCV(cvData);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar currículo. Tente novamente.");
    } finally {
      setIsGeneratingCV(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!tailoredCV) return;
    setIsDownloadingPdf(true);
    try {
      const pdfBytes = await generateCvPdf(tailoredCV);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeCandidateName = tailoredCV.fullName.replace(/[^a-zA-Z0-9]/g, '_');
      const safeJobTitle = result.jobTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      link.href = url;
      link.download = `CV_${safeCandidateName}_${safeJobTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate PDF", error);
      alert("Erro ao gerar o arquivo PDF.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  // Helper para traduzir labels das dimensões
  const dimLabels: Record<keyof DimensionScores, string> = {
    technicalCompetence: "Competência Técnica",
    sectorDomain: "Domínio Setorial",
    seniorityFit: "Senioridade",
    languageFit: "Idiomas",
    locationFit: "Localização",
    salaryFit: "Fit Salarial",
    stackFit: "Stack & Tools"
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-12 animate-slide">
      
      {/* V2.0 TIER HEADER */}
      {result.tier && (
        <div className={`text-center p-4 rounded-t-[2.5rem] border-b border-white/5 ${result.tier.includes('P0') ? 'bg-emerald-900/30' : result.tier.includes('P1') ? 'bg-blue-900/30' : 'bg-slate-900/30'}`}>
          <span className={`text-xs font-black uppercase tracking-[0.3em] ${result.tier.includes('P0') ? 'text-emerald-400' : result.tier.includes('P1') ? 'text-blue-400' : 'text-slate-400'}`}>
            CLASSIFICAÇÃO ESTRATÉGICA: {result.tier.replace('_', ' ')}
          </span>
        </div>
      )}

      {/* CARD DE RESULTADOS PRINCIPAIS */}
      <div className="bg-[#0f172a] rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl divide-y divide-white/5 relative top-[-20px]">
        <div className="p-10 bg-gradient-to-br from-[#0f172a] to-[#1e293b]/20 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-4">🎯 Executive Match Score</span>
            <span className={`text-9xl font-black italic tracking-tighter leading-none ${getScoreColor(result.matchScore)}`}>
              {result.matchScore}%
            </span>
          </div>
          <div className="flex-1 max-w-md">
            <h4 className="text-2xl font-black text-white italic uppercase mb-2 tracking-tight leading-tight">{result.jobTitle}</h4>
            <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-6">{result.company} • {result.location}</p>
            <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
               <p className="text-slate-400 text-xs leading-relaxed italic">"{result.candidateTrajectorySummary}"</p>
            </div>
          </div>
        </div>

        {/* V2.0 - RADAR DE DIMENSÕES E PROTOCOLO */}
        {result.dimensionScores && (
          <div className="grid grid-cols-1 md:grid-cols-2 bg-slate-900/20">
            <div className="p-10 border-r border-white/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500"><Target className="w-4 h-4"/></div>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Scoring Dimensional (7 Eixos)</span>
              </div>
              <div className="space-y-1">
                {Object.entries(result.dimensionScores).map(([key, value]) => (
                  <DimensionBar key={key} label={dimLabels[key as keyof DimensionScores] || key} score={value as number} />
                ))}
              </div>
            </div>
            
            <div className="p-10 flex flex-col">
              {result.actionProtocol ? (
                 <>
                   <div className="flex items-center gap-3 mb-6">
                     <div className="w-8 h-8 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500"><Zap className="w-4 h-4"/></div>
                     <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Protocolo de Ação</span>
                   </div>
                   <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-6 flex-1">
                      <h5 className="text-sm font-black text-purple-300 uppercase mb-4">{result.actionProtocol.label}</h5>
                      <ul className="space-y-3">
                        {result.actionProtocol.checklist.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                            <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
                         <span className="text-[9px] font-bold text-slate-500 uppercase">Tempo Estimado:</span>
                         <span className="text-xs font-black text-white">{result.actionProtocol.estimatedTime}</span>
                      </div>
                   </div>
                 </>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-600 text-xs font-bold uppercase">Protocolo não disponível</div>
              )}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="p-10 border-r border-white/5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">✓</div>
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Sinergias & Conexões</span>
            </div>
            <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{result.connections}</p>
          </div>
          <div className="p-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">!</div>
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Riscos & Gaps (Com Mitigação)</span>
            </div>
            <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{result.gaps}</p>
          </div>
        </div>

        {/* V2.0 DEAL BREAKERS ALERT */}
        {result.dealBreakers?.activated && (
          <div className="bg-rose-950/20 p-6 border-t border-rose-500/20">
             <div className="flex items-start gap-4">
               <AlertOctagon className="w-6 h-6 text-rose-500 shrink-0" />
               <div>
                 <h4 className="text-sm font-black text-rose-500 uppercase mb-1">DEAL-BREAKER ATIVADO</h4>
                 <p className="text-xs text-rose-300 leading-relaxed">
                   {result.dealBreakers.reason || "Critério eliminatório identificado."} (Cap de Score: {result.dealBreakers.capApplied}%)
                 </p>
               </div>
             </div>
          </div>
        )}

        {/* SEÇÃO: IMERSÃO & VALORIZAÇÃO */}
        <div className="grid grid-cols-1 md:grid-cols-2 bg-slate-900/30">
          <div className="p-10 border-r border-white/5">
             <div className="flex items-center gap-3 mb-6">
               <div className="w-8 h-8 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                 <Sun className="w-4 h-4" />
               </div>
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">O Dia a Dia (Imersão)</span>
             </div>
             <p className="text-slate-300 text-sm leading-relaxed italic font-medium">
               "{result.dayToDayScenario || 'Rotina dinâmica e desafiadora focada em resultados.'}"
             </p>
          </div>
          <div className="p-10">
             <div className="flex items-center gap-3 mb-6">
               <div className="w-8 h-8 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                 <DollarSign className="w-4 h-4" />
               </div>
               <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Expectativa Salarial</span>
             </div>
             <p className="text-2xl font-black text-white tracking-tight mb-2">
               {result.salarySpecific || 'Sob Consulta / À Combinar'}
             </p>
             <div className="flex gap-2 mb-4">
                {result.salaryFitBadge && (
                  <span className="px-2 py-1 bg-white/5 rounded text-[9px] font-black uppercase text-slate-300 border border-white/10">
                    {result.salaryFitBadge}
                  </span>
                )}
             </div>
             <div className="pt-4 border-t border-white/5">
               <span className="text-[9px] font-bold text-slate-400 uppercase">Reputação:</span>
               <p className="text-xs text-slate-300 mt-1">{result.salaryReputation}</p>
             </div>
          </div>
        </div>

        <div className="p-10 bg-black/20">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4">🚀 Diagnóstico de Posicionamento</span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-white/5">
              <p className="text-[9px] font-black text-amber-500 uppercase mb-2">Sênior Demais?</p>
              <p className="text-[10px] leading-tight text-slate-300">{result.positioningDiagnosis.overqualified}</p>
            </div>
            <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10">
              <p className="text-[9px] font-black text-emerald-500 uppercase mb-2">Match Perfeito</p>
              <p className="text-[10px] leading-tight text-slate-300">{result.positioningDiagnosis.perfect}</p>
            </div>
            <div className="bg-rose-500/5 p-5 rounded-2xl border border-rose-500/10">
              <p className="text-[9px] font-black text-rose-500 uppercase mb-2">Ruídos no Match</p>
              <p className="text-[10px] leading-tight text-slate-300">{result.positioningDiagnosis.noise}</p>
            </div>
          </div>
        </div>

        {/* V2.0 PARSED FIELDS DEBUG (TRANSPARÊNCIA) */}
        {result.parsedFields && (
          <div className="p-6 bg-slate-950/50 border-t border-white/5">
             <details className="group">
                <summary className="text-[9px] font-black text-slate-600 uppercase tracking-widest cursor-pointer list-none flex items-center gap-2 hover:text-emerald-500 transition-colors">
                  <span>▶</span> Dados Estruturados Extraídos (Auditoria do Parser)
                </summary>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] text-slate-400 font-mono">
                   <div><span className="block text-slate-600">Função:</span> {result.parsedFields.coreFunction}</div>
                   <div><span className="block text-slate-600">Setor:</span> {result.parsedFields.sector}</div>
                   <div><span className="block text-slate-600">Senioridade:</span> {result.parsedFields.seniority}</div>
                   <div><span className="block text-slate-600">Modelo:</span> {result.parsedFields.workModel}</div>
                   <div className="col-span-2"><span className="block text-slate-600">Tools:</span> {result.parsedFields.mandatoryTools?.join(', ')}</div>
                   <div className="col-span-2"><span className="block text-slate-600">Keywords:</span> {result.parsedFields.topKeywords?.join(', ')}</div>
                </div>
             </details>
          </div>
        )}
      </div>

      {/* ÁREA DE GERAÇÃO DE CV */}
      <div className="flex flex-col gap-6 no-print">
        <button 
          onClick={handleGenerateCV} 
          disabled={isGeneratingCV} 
          className="w-full py-7 bg-white text-black font-black uppercase text-xs tracking-[0.2em] rounded-[2.5rem] hover:bg-emerald-400 hover:scale-[1.02] transition-all shadow-[0_20px_50px_rgba(0,0,0,0.3)] active:scale-95 flex items-center justify-center gap-4 group disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isGeneratingCV ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Escrevendo Currículo Otimizado (V2.0)...</>
          ) : (
            <>
              <FileText className="w-5 h-5 transition-transform group-hover:rotate-12" />
              {tailoredCV ? 'Regerar Currículo para esta Vaga' : 'Gerar Currículo Otimizado ATS'}
            </>
          )}
        </button>
      </div>

      {/* RESULTADO E DOWNLOAD */}
      {tailoredCV && (
        <div ref={cvSectionRef} className="mt-12 bg-slate-900/40 p-10 rounded-[3rem] border border-white/5 animate-slide">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
            <div>
              <h3 className="text-xl font-black uppercase italic text-white tracking-tight">Otimização ATS Concluída</h3>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Pronto para download</p>
            </div>
            
            <button 
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className={`px-12 py-5 font-black uppercase text-[10px] rounded-2xl transition-all shadow-xl flex items-center gap-3 disabled:opacity-70 disabled:cursor-wait ${
                isDownloadingPdf 
                ? 'bg-slate-700 text-slate-400' 
                : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 shadow-emerald-600/20'
              }`}
            >
              {isDownloadingPdf ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Compilando PDF...</>
              ) : (
                <><Download className="w-4 h-4 group-hover:translate-y-1 transition-transform" /> Baixar PDF Finalizado</>
              )}
            </button>
          </div>
          
          {/* Preview Visual Simples em HTML */}
          <div className="relative group">
            <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"></div>
            <div className="bg-white p-12 text-black font-sans text-xs leading-relaxed rounded shadow-2xl border border-white/10 min-h-[500px] overflow-hidden">
               {/* Header Fake para Preview */}
               <div className="border-b-2 border-slate-800 pb-4 mb-6">
                 <h1 className="text-2xl font-bold uppercase">{tailoredCV.fullName}</h1>
                 <p className="text-slate-600">{tailoredCV.contactInfo}</p>
                 {tailoredCV.atsKeywords && (
                   <div className="mt-3 flex gap-2 flex-wrap">
                     {tailoredCV.atsKeywords.map((k, i) => (
                       <span key={i} className="px-2 py-0.5 bg-slate-100 text-[9px] font-bold uppercase text-slate-600 rounded">{k}</span>
                     ))}
                   </div>
                 )}
               </div>
               
               <div className="mb-6">
                 <h3 className="font-bold uppercase border-b border-slate-300 mb-2">Resumo Executivo</h3>
                 <p>{tailoredCV.summary}</p>
               </div>

               {/* V2.0 SKILLS SPLIT */}
               {(tailoredCV.hardSkills || tailoredCV.softSkills) ? (
                 <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <h3 className="font-bold uppercase border-b border-slate-300 mb-2">Hard Skills</h3>
                      <ul className="list-disc pl-4 text-slate-700">{tailoredCV.hardSkills?.map((s,i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                    <div>
                      <h3 className="font-bold uppercase border-b border-slate-300 mb-2">Soft Skills</h3>
                      <ul className="list-disc pl-4 text-slate-700">{tailoredCV.softSkills?.map((s,i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                 </div>
               ) : (
                 <div className="mb-6">
                   <h3 className="font-bold uppercase border-b border-slate-300 mb-2">Skills</h3>
                   <p>{tailoredCV.skills.join(" • ")}</p>
                 </div>
               )}

               <div className="mb-6">
                 <h3 className="font-bold uppercase border-b border-slate-300 mb-2">Experiência Profissional</h3>
                 {tailoredCV.experiences.map((exp, i) => (
                   <div key={i} className="mb-4">
                     <div className="flex justify-between font-bold text-sm">
                       <span>{exp.company}</span>
                       <span className="text-slate-500 font-normal">{exp.period}</span>
                     </div>
                     <p className="italic text-slate-600 mb-2 text-xs">{exp.role}</p>
                     <ul className="list-disc pl-4 space-y-1">
                       {exp.achievements.map((ach, j) => <li key={j}>{ach}</li>)}
                     </ul>
                   </div>
                 ))}
               </div>
            </div>
          </div>
          
          <p className="mt-6 text-center text-slate-500 text-[9px] font-black uppercase tracking-widest">
            Nota: O PDF gerado segue o padrão internacional ATS-Optimized (Robusto & Compatível).
          </p>
        </div>
      )}
    </div>
  );
};

export default AnalysisResults;