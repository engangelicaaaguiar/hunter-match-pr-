import React, { useState, useMemo } from 'react';
import { HistoryItem, ApplicationStatus, ApplicationChannel, ApplicationPlatform } from '../types';
import { Briefcase, Phone, Clock, CheckCircle2, XCircle, AlertTriangle, TrendingUp, Search, Eye, MessageSquare, Calendar, Award, UserCheck, Trash2, Zap, PhoneOff, PhoneIncoming, Download, AlertOctagon, TrendingDown, X, ChevronDown, ChevronUp } from 'lucide-react';

interface AnalysisHistoryProps {
  history: HistoryItem[];
  onDelete: (id: string) => void;
  onSelect: (item: HistoryItem) => void;
  onUpdateItem: (item: HistoryItem) => void;
}

interface Alert {
  id: string;
  itemId: string; // Para linkar com o registro
  type: 'P0_NO_OUTREACH' | 'FOLLOWUP_PENDING' | 'TIMEOUT' | 'INTERVIEW_MISSING' | 'SYSTEMIC_PATTERN';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  title: string;
  message: string;
  icon: any;
  color: string;
  actionLabel?: string;
  onAction?: () => void;
}

const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({ history, onDelete, onSelect, onUpdateItem }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [recallItem, setRecallItem] = useState<HistoryItem | null>(null);
  const [expandedAlerts, setExpandedAlerts] = useState(false);

  // === HELPERS DE FORMATAÇÃO ===
  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(ts));
  };

  const formatFullDate = (ts: number) => {
    return new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', month: '2-digit', year: '2-digit', 
      hour: '2-digit', minute: '2-digit' 
    }).format(new Date(ts));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  // === LÓGICA DE ALERTAS INTELIGENTES ===
  const activeAlerts = useMemo(() => {
      const alerts: Alert[] = [];
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      // Helper para checar se alerta foi dispensado nos últimos 7 dias
      const isDismissed = (item: HistoryItem, type: string) => {
          if (!item.dismissedAlerts || !item.dismissedAlerts[type]) return false;
          return (now - item.dismissedAlerts[type]) < (7 * oneDay);
      };

      // ALERTA TIPO 5 (SISTÊMICO)
      const last10Applied = history.filter(h => h.applied).slice(0, 10);
      if (last10Applied.length >= 5) { // Mínimo para padrão
          const advanced = last10Applied.filter(h => ['CONTATO', 'ENTREVISTA_AGENDADA', 'ENTREVISTA_REALIZADA', 'PROXIMA_FASE', 'OFERTA', 'ACEITA'].includes(h.status || ''));
          const conversion = (advanced.length / last10Applied.length);
          
          const dismissedSystemic = localStorage.getItem('hunter_systemic_alert_dismiss');
          
          if (conversion < 0.1 && (!dismissedSystemic || (now - parseInt(dismissedSystemic)) > 7 * oneDay)) {
               let msg = "Padrão detectado: suas últimas candidaturas não avançaram. Revise estratégia.";
               const applyOnlyCount = last10Applied.filter(h => h.applicationChannel === 'APPLY_ONLY').length;
               const lowMatchCount = last10Applied.filter(h => h.matchScore < 65).length;

               if (applyOnlyCount / last10Applied.length > 0.7) {
                   msg = `Padrão detectado: Baixa conversão. Causa provável: Falta de Outreach (${applyOnlyCount} de ${last10Applied.length} sem contato).`;
               } else if (lowMatchCount / last10Applied.length > 0.5) {
                   msg = "Padrão detectado: Baixa conversão. Causa provável: Candidatura em vagas com Match baixo.";
               }

               alerts.push({
                   id: 'systemic-1',
                   itemId: 'system',
                   type: 'SYSTEMIC_PATTERN',
                   priority: 'HIGH',
                   title: 'Alerta de Padrão de Não-Conversão',
                   message: msg,
                   icon: TrendingDown,
                   color: 'rose',
                   onAction: undefined // Apenas informativo
               });
          }
      }

      history.forEach(item => {
          if (!item.applied) return;
          const daysSinceApp = (now - (item.timestamp || 0)) / oneDay;

          // ALERTA TIPO 1: P0 SEM OUTREACH
          if (
              item.tier === 'P0_SNIPER' && 
              item.applicationChannel === 'APPLY_ONLY' && 
              (item.status === 'ENVIADA' || item.status === 'VISUALIZADA') &&
              !isDismissed(item, 'P0_NO_OUTREACH')
          ) {
              alerts.push({
                  id: `p0-${item.id}`,
                  itemId: item.id,
                  type: 'P0_NO_OUTREACH',
                  priority: 'CRITICAL',
                  title: 'Oportunidade P0 em Risco',
                  message: `Vaga P0 na ${item.company} sem outreach. Contato direto triplica suas chances.`,
                  icon: Zap,
                  color: 'emerald', // Verde brilhante para destacar oportunidade positiva
                  actionLabel: 'VER SUGESTÃO OUTREACH',
                  onAction: () => setRecallItem(item)
              });
          }

          // ALERTA TIPO 2: FOLLOW-UP PENDENTE
          if (
              item.applicationChannel === 'APPLY_OUTREACH' &&
              (!item.outreachResponse || item.outreachResponse === 'NONE') &&
              daysSinceApp >= 5 && daysSinceApp <= 10 &&
              !isDismissed(item, 'FOLLOWUP_PENDING')
          ) {
              alerts.push({
                  id: `fup-${item.id}`,
                  itemId: item.id,
                  type: 'FOLLOWUP_PENDING',
                  priority: 'HIGH',
                  title: 'Follow-up Recomendado',
                  message: `Outreach para ${item.company} sem resposta há ${Math.floor(daysSinceApp)} dias.`,
                  icon: Clock,
                  color: 'amber',
                  actionLabel: 'PREPARAR FOLLOW-UP',
                  onAction: () => setRecallItem(item)
              });
          }

          // ALERTA TIPO 3: TIMEOUT (Limpeza)
          if (
              (item.status === 'ENVIADA' || item.status === 'VISUALIZADA') &&
              daysSinceApp >= 21 &&
              !isDismissed(item, 'TIMEOUT')
          ) {
              alerts.push({
                  id: `timeout-${item.id}`,
                  itemId: item.id,
                  type: 'TIMEOUT',
                  priority: 'MEDIUM',
                  title: 'Candidatura Estagnada',
                  message: `Vaga na ${item.company} sem retorno há ${Math.floor(daysSinceApp)} dias.`,
                  icon: AlertOctagon, // Icone de gelo/parado
                  color: 'slate',
                  actionLabel: 'MARCAR SEM RETORNO',
                  onAction: () => {
                      const newHistory = [...(item.statusHistory || []), { status: 'SEM_RETORNO', timestamp: Date.now(), auto: true }];
                      onUpdateItem({ ...item, status: 'SEM_RETORNO', statusHistory: newHistory as any });
                  }
              });
          }

          // ALERTA TIPO 4: ENTREVISTA SEM RESULTADO
          // Assume que se está em ENTREVISTA_AGENDADA e passou 24h da última atualização (ou data de entrevista se tivéssemos), já ocorreu.
          // Usando timestamp da última atualização de status como proxy se interviewDate não existir.
          const lastStatusUpdate = item.statusHistory ? item.statusHistory[item.statusHistory.length - 1].timestamp : item.timestamp;
          const daysSinceLastUpdate = (now - lastStatusUpdate) / oneDay;

          if (
              item.status === 'ENTREVISTA_AGENDADA' &&
              daysSinceLastUpdate >= 1 && // 1 dia após agendamento assumimos que já ocorreu ou está próximo
              !item.interviewImpression &&
              !isDismissed(item, 'INTERVIEW_MISSING')
          ) {
              alerts.push({
                  id: `int-${item.id}`,
                  itemId: item.id,
                  type: 'INTERVIEW_MISSING',
                  priority: 'MEDIUM',
                  title: 'Feedback de Entrevista Pendente',
                  message: `Entrevista na ${item.company} já ocorreu? Registre sua impressão.`,
                  icon: MessageSquare,
                  color: 'amber',
                  actionLabel: 'REGISTRAR RESULTADO',
                  onAction: () => {
                      // Hack rápido: abrir prompt nativo para simplicidade, ideal seria modal
                      const result = window.prompt("Como foi a entrevista? (BEM, NEUTRO, MAL)");
                      if (result) {
                          let imp: any = 'NEUTRAL';
                          if (result.toLowerCase().includes('bem')) imp = 'POSITIVE';
                          if (result.toLowerCase().includes('mal')) imp = 'NEGATIVE';
                          
                          const newHistory = [...(item.statusHistory || []), { status: 'ENTREVISTA_REALIZADA', timestamp: Date.now() }];
                          onUpdateItem({ 
                              ...item, 
                              status: 'ENTREVISTA_REALIZADA', 
                              interviewImpression: imp,
                              statusHistory: newHistory as any 
                          });
                      }
                  }
              });
          }
      });

      // ORDENAÇÃO: SYSTEMIC -> CRITICAL -> HIGH -> MEDIUM
      const priorityOrder = { 'SYSTEMIC_PATTERN': 0, 'CRITICAL': 1, 'HIGH': 2, 'MEDIUM': 3 };
      return alerts.sort((a, b) => {
          const pA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 99;
          const pB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 99;
          return pA - pB;
      });

  }, [history]);

  const handleDismissAlert = (alert: Alert) => {
      if (alert.type === 'SYSTEMIC_PATTERN') {
          localStorage.setItem('hunter_systemic_alert_dismiss', Date.now().toString());
          // Force re-render (hacky but works for localstorage dependency)
          onUpdateItem({ ...history[0] }); 
          return;
      }

      const item = history.find(h => h.id === alert.itemId);
      if (item) {
          const newDismissed = { ...item.dismissedAlerts, [alert.type]: Date.now() };
          onUpdateItem({ ...item, dismissedAlerts: newDismissed });
      }
  };

  // === LÓGICA DE PROBABILIDADE (ENGINE V2.0) ===
  const calculateProbabilityDetails = (item: HistoryItem) => {
    // Fatores individuais
    const getMatchFactor = (score: number) => {
        if (score >= 90) return 90 + (score - 90);
        if (score >= 80) return 65 + ((score - 80) / 9) * 24;
        if (score >= 70) return 45 + ((score - 70) / 9) * 19;
        if (score >= 55) return 20 + ((score - 55) / 14) * 24;
        return 5 + (score / 54) * 14;
    };
    const factorMatch = getMatchFactor(item.matchScore);

    const getChannelFactor = (channel?: string, status?: string) => {
        if (channel === 'INBOUND') return 90;
        if (channel === 'INDICACAO') return 82;
        if (channel === 'APPLY_OUTREACH') {
            if (['CONTATO', 'ENTREVISTA_AGENDADA', 'PROXIMA_FASE'].includes(status || '')) return 75;
            if (status === 'VISUALIZADA') return 60;
            if (status === 'REJEITADA') return 30;
            return 50; 
        }
        return 18; 
    };
    const factorChannel = getChannelFactor(item.applicationChannel, item.status);

    const getCompetitivenessFactor = () => {
        let score = 5; 
        const isRemote = item.workModel === 'Remoto';
        const isHybrid = item.workModel === 'Híbrido';
        const company = item.company.toLowerCase();
        
        const tier1Brands = ['google', 'amazon', 'uber', 'nubank', 'ifood', 'mercado livre', 'totvs', 'ambev', 'itau', 'globo', 'microsoft', 'apple', 'meta', 'netflix', 'stone', 'xp', 'btg'];
        const isTier1 = tier1Brands.some(t => company.includes(t));
        
        const toolCount = item.parsedFields?.mandatoryTools?.length || 0;
        const kwCount = item.parsedFields?.topKeywords?.length || 0;
        const isNiche = toolCount > 4 || kwCount > 6; 

        let compScore = 5;
        if (isRemote) {
            if (isTier1 && !isNiche) compScore = 10;
            else if (isTier1 && isNiche) compScore = 7;
            else if (!isTier1 && !isNiche) compScore = 8;
            else compScore = 5;
        } else if (isHybrid) {
            if (isTier1 && !isNiche) compScore = 7;
            else if (!isTier1 && !isNiche) compScore = 5;
            else compScore = 3;
        } else { 
            compScore = isNiche ? 2 : 4;
        }

        const map: Record<number, number> = { 10: 15, 9: 22, 8: 30, 7: 38, 6: 47, 5: 55, 4: 63, 3: 72, 2: 82, 1: 92 };
        return map[compScore] || 55;
    };
    const factorCompetitiveness = getCompetitivenessFactor();

    const getTimingFactor = (ts: number) => {
        const days = (Date.now() - ts) / (1000 * 60 * 60 * 24);
        if (days <= 1.5) return 100;
        if (days <= 3.5) return 88;
        if (days <= 7.5) return 72;
        if (days <= 14.5) return 50;
        if (days <= 21.5) return 28;
        if (days <= 30.5) return 12;
        return 5;
    };
    const factorTiming = getTimingFactor(item.timestamp);

    const getDealBreakerFactor = () => {
        if (!item.dealBreakers) return 80;
        if (!item.dealBreakers.activated) return 100;
        const cap = item.dealBreakers.capApplied;
        if (cap >= 55) return 55;
        if (cap >= 50) return 45;
        if (cap >= 40) return 32;
        if (cap >= 35) return 25;
        if (cap >= 30) return 18;
        return 10;
    };
    const factorDealBreaker = getDealBreakerFactor();

    let totalScore = 
        (factorMatch * 0.35) + 
        (factorChannel * 0.25) + 
        (factorCompetitiveness * 0.20) + 
        (factorTiming * 0.10) + 
        (factorDealBreaker * 0.10);
    
    totalScore = Math.round(totalScore);

    let result = { percent: totalScore, label: 'IMPROVÁVEL', color: 'text-rose-500', icon: XCircle };
    if (totalScore > 25) result = { percent: totalScore, label: 'ALTA', color: 'text-emerald-500', icon: PhoneIncoming };
    else if (totalScore >= 15) result = { percent: totalScore, label: 'MÉDIA', color: 'text-amber-500', icon: Phone };
    else if (totalScore >= 8) result = { percent: totalScore, label: 'BAIXA', color: 'text-orange-500', icon: PhoneOff };

    if (item.status && ['CONTATO', 'ENTREVISTA_AGENDADA', 'ENTREVISTA_REALIZADA', 'PROXIMA_FASE', 'OFERTA'].includes(item.status)) {
        result = { percent: 100, label: 'EM ANDAMENTO', color: 'text-blue-400', icon: TrendingUp };
    }
    if (item.status === 'ACEITA') {
        result = { percent: 100, label: 'CONTRATADO', color: 'text-emerald-500', icon: Award };
    }
    if (item.status === 'REJEITADA' || item.status === 'DESISTI' || item.status === 'SEM_RETORNO') {
        result = { percent: 0, label: 'ENCERRADA', color: 'text-slate-600', icon: XCircle };
    }

    return {
        ...result,
        breakdown: {
            match: Math.round(factorMatch),
            channel: Math.round(factorChannel),
            competitiveness: Math.round(factorCompetitiveness),
            timing: Math.round(factorTiming),
            dealBreaker: Math.round(factorDealBreaker)
        }
    };
  };

  const calculateWinProbability = (item: HistoryItem) => calculateProbabilityDetails(item);

  // === LÓGICA DE STATUS E CORES ===
  const statusConfig: Record<string, { label: string, color: string, icon: any }> = {
    'ENVIADA': { label: 'Enviada', color: 'bg-slate-700 text-slate-300', icon: CheckCircle2 },
    'VISUALIZADA': { label: 'Visualizada', color: 'bg-blue-900/50 text-blue-300', icon: Eye },
    'CONTATO': { label: 'Contato', color: 'bg-amber-900/50 text-amber-300', icon: MessageSquare },
    'ENTREVISTA_AGENDADA': { label: 'Entrevista', color: 'bg-emerald-900/50 text-emerald-300', icon: Calendar },
    'ENTREVISTA_REALIZADA': { label: 'Realizada', color: 'bg-emerald-800/50 text-emerald-200', icon: CheckCircle2 },
    'PROXIMA_FASE': { label: 'Próx. Fase', color: 'bg-purple-900/50 text-purple-300', icon: TrendingUp },
    'OFERTA': { label: 'Oferta', color: 'bg-yellow-900/50 text-yellow-300', icon: Award },
    'ACEITA': { label: 'Aceita', color: 'bg-emerald-600 text-white', icon: UserCheck },
    'REJEITADA': { label: 'Rejeitada', color: 'bg-rose-900/50 text-rose-300', icon: XCircle },
    'SEM_RETORNO': { label: 'Sem Retorno', color: 'bg-slate-800 text-slate-500', icon: Clock },
    'DESISTI': { label: 'Desisti', color: 'bg-slate-800 text-slate-400', icon: XCircle },
  };

  const updateItemStatus = (item: HistoryItem, newStatus: ApplicationStatus) => {
    const historyEntry = { status: newStatus, timestamp: Date.now() };
    const newHistory = [...(item.statusHistory || []), historyEntry];
    onUpdateItem({ 
        ...item, 
        status: newStatus, 
        statusHistory: newHistory,
        lastUpdated: Date.now()
    });
  };

  const handleToggleApplied = (item: HistoryItem) => {
      if (item.applied) {
          onUpdateItem({ ...item, applied: false, status: undefined, applicationChannel: undefined });
      } else {
          onUpdateItem({ 
              ...item, 
              applied: true, 
              status: 'ENVIADA', 
              applicationChannel: 'APPLY_ONLY', 
              applicationPlatform: 'LINKEDIN',
              statusHistory: [{ status: 'ENVIADA', timestamp: Date.now() }] 
            });
      }
  };

  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(item => 
      item.company.toLowerCase().includes(term) ||
      item.jobTitle.toLowerCase().includes(term) ||
      item.tier?.toLowerCase().includes(term) ||
      item.status?.toLowerCase().includes(term)
    );
  }, [history, searchTerm]);

  const metrics = useMemo(() => {
      const activeApps = history.filter(h => h.applied && !['REJEITADA', 'SEM_RETORNO', 'DESISTI', 'ACEITA'].includes(h.status || ''));
      const interviews = history.filter(h => ['ENTREVISTA_AGENDADA', 'ENTREVISTA_REALIZADA', 'PROXIMA_FASE'].includes(h.status || '')).length;
      
      const sent = history.filter(h => h.status === 'ENVIADA').length;
      const contacted = history.filter(h => ['CONTATO', 'ENTREVISTA_AGENDADA', 'ENTREVISTA_REALIZADA'].includes(h.status || '')).length;
      const conversionRate = sent > 0 ? Math.round((contacted / (sent + contacted)) * 100) : 0;

      return { active: activeApps.length, interviews, conversionRate };
  }, [history]);

  const downloadCSV = () => {
     if (filteredHistory.length === 0) {
       alert("Nenhum dado para exportar com os filtros atuais.");
       return;
     }

     const headers = [
         "ID", "Data", "Vaga", "Empresa",
         "Tier", "Score", "Modelo de Trabalho", "Setor", "Senioridade da Vaga", "Tipo de Contratante",
         "Probabilidade", "Badge de Probabilidade", "Urgência", "Dias no Pipeline",
         "Status", "Canal", "Plataforma", "Data da Candidatura", "Outreach Realizado", "Data do Outreach", "Resposta ao Outreach",
         "Data da Entrevista", "Formato da Entrevista", "Impressão da Entrevista",
         "Valor da Oferta", "Regime da Oferta",
         "Estágio da Rejeição", "Motivo da Rejeição",
         "Override", "Justificativa do Override",
         "Ação Recomendada",
         "Match Factor", "Channel Factor", "Competitiveness Factor", "Timing Factor", "DealBreaker Factor"
     ];

     const escapeCsv = (text: string | number | undefined | null) => {
         if (text === undefined || text === null) return "";
         const str = String(text);
         if (str.includes(",") || str.includes('"') || str.includes("\n")) {
             return `"${str.replace(/"/g, '""')}"`;
         }
         return str;
     };

     const rows = filteredHistory.map(item => {
         const prob = calculateProbabilityDetails(item);
         const daysInPipeline = item.timestamp ? Math.floor((Date.now() - item.timestamp) / (1000 * 60 * 60 * 24)) : 0;
         
         let urgency = "COLD";
         if (daysInPipeline < 3) urgency = "HOT";
         else if (daysInPipeline < 7) urgency = "WARM";
         else if (daysInPipeline < 21) urgency = "COOLING";
         else if (item.status === 'ENVIADA') urgency = "ACTION_NEEDED";

         let action = "Monitorar";
         if (item.status === 'ENVIADA' && daysInPipeline > 7) action = "Realizar Outreach ou Follow-up";
         if (item.status === 'CONTATO') action = "Preparar para Triagem";
         if (prob.percent < 20 && daysInPipeline > 30) action = "Marcar como Sem Retorno";
         if (item.tier === 'P0_SNIPER' && item.applicationChannel === 'APPLY_ONLY') action = "CRÍTICO: Fazer Outreach Agora";

         return [
             item.id,
             formatFullDate(item.timestamp),
             item.jobTitle,
             item.company,
             item.tier?.split('_')[1] || item.tier,
             item.matchScore, 
             item.parsedFields?.workModel || item.workModel,
             item.parsedFields?.sector,
             item.parsedFields?.seniority,
             "",
             prob.percent,
             prob.label,
             urgency,
             daysInPipeline,
             item.status || "NOT_APPLIED",
             item.applicationChannel,
             item.applicationPlatform,
             item.applied ? formatFullDate(item.timestamp) : "",
             item.applicationChannel === 'APPLY_OUTREACH' || item.applicationChannel === 'INDICACAO' ? "SIM" : "NÃO",
             "", 
             "", 
             "", 
             "", 
             "", 
             "", 
             "", 
             item.status === 'REJEITADA' ? "FINAL" : "",
             "", 
             "", 
             "", 
             action,
             prob.breakdown.match,
             prob.breakdown.channel,
             prob.breakdown.competitiveness,
             prob.breakdown.timing,
             prob.breakdown.dealBreaker
         ].map(escapeCsv).join(",");
     });

     const csvContent = "\ufeff" + [headers.join(","), ...rows].join("\n");
     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
     const link = document.createElement("a");
     link.href = URL.createObjectURL(blob);
     link.download = `HunterMatch_Export_v2_${new Date().toISOString().slice(0,10)}.csv`;
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-700 rounded-3xl">
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhuma análise salva ainda</p>
      </div>
    );
  }

  const visibleAlerts = expandedAlerts ? activeAlerts : activeAlerts.slice(0, 5);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* SEÇÃO DE ALERTAS INTELIGENTES */}
      {activeAlerts.length > 0 && (
          <div className="mb-8 space-y-3">
             <div className="flex items-center justify-between mb-2">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                     <AlertTriangle className="w-3 h-3 text-amber-500"/>
                     Alertas de Ação ({activeAlerts.length})
                 </h4>
             </div>
             
             <div className="grid gap-3">
                 {visibleAlerts.map(alert => (
                     <div key={alert.id} className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all relative group ${
                         alert.priority === 'CRITICAL' ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40' :
                         alert.priority === 'HIGH' ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40' :
                         alert.priority === 'MEDIUM' ? 'bg-slate-800/40 border-white/5 hover:border-white/10' :
                         'bg-rose-500/5 border-rose-500/10'
                     }`}>
                         <div className="flex items-center gap-4">
                             <div className={`p-2.5 rounded-lg ${
                                 alert.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-500' :
                                 alert.color === 'amber' ? 'bg-amber-500/10 text-amber-500' :
                                 alert.color === 'rose' ? 'bg-rose-500/10 text-rose-500' :
                                 'bg-slate-700 text-slate-400'
                             }`}>
                                 <alert.icon className="w-5 h-5" />
                             </div>
                             <div>
                                 <h5 className={`text-sm font-black uppercase mb-0.5 ${
                                     alert.color === 'emerald' ? 'text-white' : 
                                     alert.color === 'amber' ? 'text-amber-100' :
                                     alert.color === 'rose' ? 'text-rose-200' : 'text-slate-300'
                                 }`}>
                                     {alert.title}
                                 </h5>
                                 <p className="text-xs text-slate-400 font-medium">{alert.message}</p>
                             </div>
                         </div>
                         
                         <div className="flex items-center gap-3">
                             {alert.onAction && (
                                 <button 
                                   onClick={alert.onAction}
                                   className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg border transition-all hover:scale-105 active:scale-95 ${
                                     alert.color === 'emerald' ? 'bg-emerald-600 text-white border-transparent hover:bg-emerald-500' :
                                     'bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700 hover:text-white'
                                   }`}
                                 >
                                     {alert.actionLabel || 'Resolver'}
                                 </button>
                             )}
                             <button 
                               onClick={() => handleDismissAlert(alert)}
                               className="p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                               title="Dispensar alerta (7 dias)"
                             >
                                 <X className="w-4 h-4" />
                             </button>
                         </div>
                     </div>
                 ))}
             </div>
             
             {activeAlerts.length > 5 && (
                 <button 
                   onClick={() => setExpandedAlerts(!expandedAlerts)}
                   className="w-full py-2 text-[10px] font-black uppercase text-slate-500 hover:text-white flex items-center justify-center gap-1 transition-colors"
                 >
                     {expandedAlerts ? <><ChevronUp className="w-3 h-3"/> Recolher Alertas</> : <><ChevronDown className="w-3 h-3"/> Ver mais {activeAlerts.length - 5} alertas</>}
                 </button>
             )}
          </div>
      )}

      {/* PAINEL DE INTELIGÊNCIA DO FUNIL (Acima da tabela) */}
      {history.some(h => h.applied) && (
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-slate-900/60 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Candidaturas Ativas</span>
                <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-white leading-none">{metrics.active}</span>
                    <Briefcase className="w-5 h-5 text-emerald-500 mb-1" />
                </div>
             </div>
             <div className="bg-slate-900/60 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Entrevistas (Pipeline)</span>
                <div className="flex items-end gap-2">
                    <span className="text-3xl font-black text-white leading-none">{metrics.interviews}</span>
                    <TrendingUp className="w-5 h-5 text-blue-500 mb-1" />
                </div>
             </div>
             <div className="bg-slate-900/60 border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Conv. (Enviada → Contato)</span>
                <div className="flex items-end gap-2">
                    <span className={`text-3xl font-black leading-none ${metrics.conversionRate < 10 ? 'text-rose-500' : 'text-emerald-500'}`}>{metrics.conversionRate}%</span>
                    <span className="text-[9px] text-slate-500 font-bold mb-1">MÉDIA GLOBAL: 12%</span>
                </div>
             </div>
             <div className="bg-gradient-to-br from-emerald-900/20 to-slate-900 border border-emerald-500/20 p-4 rounded-2xl flex flex-col justify-center items-center text-center cursor-pointer hover:border-emerald-500/50 transition-all">
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Recall Engine</span>
                <span className="text-xs text-slate-300 font-bold">Preparar Entrevista</span>
             </div>
        </div>
      )}

      {/* SEARCH E ACTIONS */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
         <div className="w-full max-w-lg relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Buscar por Vaga, Empresa, Tier ou Status..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0f172a] border border-white/5 rounded-xl pl-12 pr-4 py-3 text-xs text-white uppercase font-bold focus:border-emerald-500/50 outline-none"
            />
         </div>
         <button onClick={downloadCSV} className="text-[10px] font-black uppercase text-slate-500 hover:text-white flex items-center gap-2 px-6 py-3 bg-slate-900 rounded-xl border border-white/5 hover:bg-emerald-600 transition-all shadow-lg">
            <Download className="w-4 h-4" /> Exportar CSV v2.0
         </button>
      </div>

      {/* TABELA V2.0 */}
      <div className="overflow-hidden rounded-[2rem] border border-white/5 bg-[#0f172a] shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-white/5">
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Me Candidatei?</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Tier</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Vaga & Empresa</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Match</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">🎯 Chances</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Status Funil</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredHistory.map((item) => {
                const prob = calculateWinProbability(item);
                const currentStatus = statusConfig[item.status || 'ENVIADA'] || statusConfig['ENVIADA'];
                
                return (
                  <tr 
                    key={item.id} 
                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                    onClick={() => onSelect(item)}
                  >
                    {/* COLUNA 1: ME CANDIDATEI */}
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                       <div className="flex items-center gap-3">
                         <button 
                            onClick={() => handleToggleApplied(item)}
                            className={`w-10 h-6 rounded-full relative transition-colors ${item.applied ? 'bg-emerald-600' : 'bg-slate-700'}`}
                         >
                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${item.applied ? 'translate-x-4' : 'translate-x-0'}`}></div>
                         </button>
                         <span className={`text-[10px] font-black uppercase ${item.applied ? 'text-white' : 'text-slate-600'}`}>
                           {item.applied ? 'SIM' : 'NÃO'}
                         </span>
                       </div>
                       {/* Seletor de Canal embutido se Applied */}
                       {item.applied && (
                         <select 
                           className="mt-2 text-[9px] bg-black/20 border border-white/10 rounded text-slate-400 p-1 w-full outline-none focus:border-emerald-500/50"
                           value={item.applicationChannel || 'APPLY_ONLY'}
                           onChange={(e) => onUpdateItem({...item, applicationChannel: e.target.value as ApplicationChannel})}
                         >
                           <option value="APPLY_ONLY">Só Apply</option>
                           <option value="APPLY_OUTREACH">Apply + Outreach</option>
                           <option value="INDICACAO">Indicação</option>
                           <option value="INBOUND">Inbound</option>
                         </select>
                       )}
                    </td>

                    {/* COLUNA 2: TIER */}
                    <td className="px-6 py-4">
                       {item.tier ? (
                         <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider border ${
                           item.tier === 'P0_SNIPER' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                           item.tier === 'P1_TARGETED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                           item.tier === 'P2_VOLUME' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                           'bg-rose-500/10 text-rose-500 border-rose-500/20'
                         }`}>
                           {item.tier.split('_')[1] || item.tier}
                         </span>
                       ) : (
                         <span className="text-[9px] text-slate-600 font-bold">-</span>
                       )}
                       <div className="text-[9px] text-slate-600 mt-1 font-mono">{formatDate(item.timestamp)}</div>
                    </td>

                    {/* COLUNA 3: VAGA */}
                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-white truncate max-w-[180px]">{item.jobTitle}</div>
                      <div className="text-[9px] font-black text-slate-500 uppercase truncate max-w-[180px]">{item.company}</div>
                    </td>

                    {/* COLUNA 4: MATCH */}
                    <td className="px-6 py-4 text-center">
                      <span className={`text-lg font-black italic ${getScoreColor(item.matchScore)}`}>
                        {item.matchScore}%
                      </span>
                    </td>

                    {/* COLUNA 5: CHANCES */}
                    <td className="px-6 py-4">
                       {item.applied ? (
                         <div className="flex items-center gap-2">
                            <prob.icon className={`w-4 h-4 ${prob.color}`} />
                            <div>
                               <div className={`text-[10px] font-black uppercase ${prob.color}`}>{prob.label}</div>
                               <div className="text-[9px] text-slate-600 font-bold">{prob.percent > 0 ? `${prob.percent}% Prob.` : ''}</div>
                            </div>
                         </div>
                       ) : (
                         <span className="text-[9px] text-slate-700 font-bold uppercase">Não Iniciado</span>
                       )}
                    </td>

                    {/* COLUNA 6: STATUS FUNIL */}
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                       {item.applied ? (
                         <div className="relative group/status">
                            <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border border-white/5 w-full justify-between transition-all ${currentStatus.color}`}>
                               <div className="flex items-center gap-2">
                                 <currentStatus.icon className="w-3 h-3" />
                                 <span>{currentStatus.label}</span>
                               </div>
                            </button>
                            {/* Dropdown nativo ou customizado - usando select por simplicidade e robustez */}
                            <select 
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              value={item.status || 'ENVIADA'}
                              onChange={(e) => updateItemStatus(item, e.target.value as ApplicationStatus)}
                            >
                              {Object.keys(statusConfig).map(key => (
                                <option key={key} value={key}>{statusConfig[key].label}</option>
                              ))}
                            </select>
                         </div>
                       ) : (
                         <span className="text-[9px] text-slate-700 font-bold uppercase">-</span>
                       )}
                    </td>

                    {/* COLUNA 7: AÇÕES */}
                    <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                         <button 
                           onClick={(e) => { e.stopPropagation(); setRecallItem(item); }}
                           className={`p-2 rounded-lg transition-all border border-white/5 ${['ENTREVISTA_AGENDADA', 'ENTREVISTA_REALIZADA'].includes(item.status || '') ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-800 text-emerald-500 hover:text-white'}`}
                           title={['ENTREVISTA_AGENDADA', 'ENTREVISTA_REALIZADA'].includes(item.status || '') ? "Preparar Entrevista" : "Visualizar Recall"}
                         >
                            {['ENTREVISTA_AGENDADA', 'ENTREVISTA_REALIZADA'].includes(item.status || '') ? <Zap className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                           className="p-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all border border-transparent hover:border-rose-400"
                         >
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECALL ENGINE V2.0 MODAL */}
      {recallItem && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setRecallItem(null)}
        >
          <div 
            className="bg-[#0f172a] border border-emerald-500/40 w-full max-w-2xl rounded-[2.5rem] shadow-2xl shadow-emerald-500/20 overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/10 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className={`p-8 border-b border-white/5 flex justify-between items-start ${['ENTREVISTA_AGENDADA', 'ENTREVISTA_REALIZADA'].includes(recallItem.status || '') ? 'bg-emerald-900/20' : 'bg-slate-900/50'}`}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 text-[8px] font-black uppercase text-white rounded shadow-sm ${['ENTREVISTA_AGENDADA', 'ENTREVISTA_REALIZADA'].includes(recallItem.status || '') ? 'bg-emerald-600 animate-pulse' : 'bg-slate-600'}`}>
                    {['ENTREVISTA_AGENDADA', 'ENTREVISTA_REALIZADA'].includes(recallItem.status || '') ? 'MODO PREPARAÇÃO DE ENTREVISTA' : 'MODO TELEPROMPTER'}
                  </span>
                  <span className={`text-xs font-black italic ${getScoreColor(recallItem.matchScore)}`}>{recallItem.matchScore}% Match</span>
                </div>
                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none mb-1">{recallItem.jobTitle}</h3>
                <p className="text-xs text-emerald-500 font-black uppercase tracking-widest">{recallItem.company}</p>
              </div>
              <button onClick={() => setRecallItem(null)} className="p-2 bg-white/5 hover:bg-rose-500 text-slate-400 hover:text-white rounded-xl"><XCircle className="w-5 h-5"/></button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
              
              {/* SEÇÃO ESPECIAL DE ENTREVISTA (Recall v2) */}
              {['ENTREVISTA_AGENDADA', 'ENTREVISTA_REALIZADA'].includes(recallItem.status || '') && (
                 <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl mb-6">
                    <h4 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Zap className="w-4 h-4"/> Argumentos de Ouro (Use na Entrevista)</h4>
                    <ul className="space-y-4">
                       <li className="text-xs text-slate-200 leading-relaxed"><strong className="text-emerald-500">Argumento 1:</strong> Com base na sinergia identificada, mencione: "{recallItem.connections.split('\n')[0] || 'Sua experiência no setor'}"</li>
                       <li className="text-xs text-slate-200 leading-relaxed"><strong className="text-emerald-500">Defesa de Gap:</strong> Se perguntarem sobre gaps, responda com sua mitigação: "{recallItem.gaps.split('\n')[0] || 'Vontade de aprender rápido'}"</li>
                       <li className="text-xs text-slate-200 leading-relaxed"><strong className="text-emerald-500">Pergunte a eles:</strong> "Como é o dia a dia descrito na vaga: {recallItem.dayToDayScenario?.slice(0, 50)}...?"</li>
                    </ul>
                 </div>
              )}

              <section>
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Pitch de Elevador (Quem sou eu para esta vaga?)</h4>
                <p className="text-sm text-slate-100 leading-relaxed font-semibold bg-white/5 p-4 rounded-xl border border-white/5 italic">
                  "{recallItem.candidateTrajectorySummary}"
                </p>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section>
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Pontos Fortes</h4>
                  <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-900/40 p-4 rounded-xl border border-white/5 h-full">
                    {recallItem.connections}
                  </div>
                </section>
                <section>
                  <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">Pontos de Atenção</h4>
                  <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-900/40 p-4 rounded-xl border border-white/5 h-full">
                    {recallItem.gaps}
                  </div>
                </section>
              </div>

              <section className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
                <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">Insight Salarial</h4>
                <p className="text-xs text-white font-bold">{recallItem.salarySpecific}</p>
                <p className="text-[9px] text-slate-500 mt-1">{recallItem.salaryReputation}</p>
              </section>
            </div>
            
            <div className="p-6 bg-slate-950 border-t border-white/10 flex justify-center">
               <button 
                 onClick={() => { onSelect(recallItem); setRecallItem(null); }}
                 className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs rounded-2xl transition-all shadow-lg"
               >
                 Abrir Auditoria Completa
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisHistory;