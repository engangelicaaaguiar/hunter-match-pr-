
import React from 'react';
import { AnalysisResult } from '../types';

interface AnalysisResultsProps {
  result: AnalysisResult;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ result }) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  const rows = [
    { label: "1. 🎯 Score de Match (0-100%)", content: result.matchScore + "%", isScore: true },
    { label: "2. ✅ Todos os Pontos de Conexão", content: result.connections },
    { label: "3. ⚠️ Gaps e Riscos", content: result.gaps },
    { label: "4. 🗣️ Pitch de Entrevista", content: result.interviewPitch, isItalic: true },
    { label: "5. 📝 Resumo de Adequação e Dia a Dia", content: result.adequacySummary }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-1 bg-emerald-500 rounded-full"></div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Relatório de Candidatura Estratégica</h2>
            <p className="text-slate-500 text-xs font-medium">{result.jobTitle} • {result.company}</p>
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Headhunter AI Engine</p>
          <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-tighter italic">Vaga Auditada</p>
        </div>
      </div>

      <div className="bg-[#1e293b] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-700 last:border-0 hover:bg-slate-800/10 transition-colors">
                <td className="p-0">
                  <div className="bg-slate-800/50 px-6 py-3 border-b border-slate-700/50">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{row.label}</span>
                  </div>
                  <div className="px-6 py-6 bg-slate-900/10">
                    {row.isScore ? (
                      <div className="flex items-center gap-4">
                        <span className={`text-6xl font-black ${getScoreColor(result.matchScore)}`}>
                          {row.content}
                        </span>
                        {result.requiresFluentEnglish && (
                          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-tighter">
                            Penalidade Aplicada: Inglês Fluente
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className={`text-slate-200 leading-relaxed ${row.isItalic ? 'italic text-blue-300 text-lg font-medium' : 'text-base'}`}>
                        {row.content}
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center px-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Documento Confidencial • Auditoria de Carreira</p>
        <button 
          onClick={() => window.print()}
          className="text-[10px] text-emerald-500 hover:text-emerald-400 transition-colors font-bold uppercase tracking-widest flex items-center gap-2"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Exportar PDF
        </button>
      </div>
    </div>
  );
};

export default AnalysisResults;
