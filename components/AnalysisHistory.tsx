
import React from 'react';
import { HistoryItem } from '../types';

interface AnalysisHistoryProps {
  history: HistoryItem[];
  onDelete: (id: string) => void;
  onSelect: (item: HistoryItem) => void;
}

const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({ history, onDelete, onSelect }) => {
  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-700 rounded-3xl">
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhuma análise salva ainda</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Histórico de Auditorias</h2>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Gestão de Candidaturas de Angélica Aguiar</p>
        </div>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">
          {history.length} REGISTROS
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/50 shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/80 border-b border-slate-700">
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data/Hora</th>
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vaga / Empresa</th>
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Local / Modelo</th>
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Score</th>
              <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {history.map((item) => (
              <tr 
                key={item.id} 
                className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                onClick={() => onSelect(item)}
              >
                <td className="px-4 py-4 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                  {formatDate(item.timestamp)}
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm font-bold text-white truncate max-w-[200px]">{item.jobTitle}</div>
                  <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tight truncate max-w-[200px]">{item.company}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-[11px] text-slate-300 font-medium">{item.location}</div>
                  <div className={`text-[9px] font-bold uppercase tracking-tighter inline-block px-1.5 py-0.5 rounded mt-1 
                    ${item.workModel === 'Remoto' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                      item.workModel === 'Híbrido' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                      'bg-slate-700 text-slate-300'}`}>
                    {item.workModel}
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className={`text-xl font-black ${getScoreColor(item.matchScore)}`}>
                    {item.matchScore}%
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      className="p-2 hover:bg-rose-500/20 text-slate-600 hover:text-rose-400 rounded-lg transition-all"
                      title="Excluir Registro"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AnalysisHistory;
