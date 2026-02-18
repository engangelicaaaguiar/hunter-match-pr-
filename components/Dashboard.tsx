
import React, { useMemo, useState, useEffect } from 'react';
import { getTelemetryData } from '../services/telemetryService';
import { analyzeDashboardMetrics } from '../services/geminiService';
import { storage } from '../services/storageService';
import { UserRole, SystemSettings, GlobalStats, TelemetryData } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Activity, AlertTriangle, Clock, TrendingUp, Users, DollarSign, Heart, ShieldCheck, Zap } from 'lucide-react';

interface DashboardProps {
  userRole: UserRole;
}

const Dashboard: React.FC<DashboardProps> = ({ userRole }) => {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    const load = async () => {
      const tel = await getTelemetryData();
      setData(tel);
      if (userRole === 'OWNER') {
        const stats = await storage.getGlobalStats();
        const conf = await storage.getSettings();
        setGlobalStats(stats);
        setSettings(conf);
      }
    };
    load();
  }, [userRole]);

  const handleAIInsight = async () => {
    if (!data) return;
    setIsAnalyzing(true);
    setInsight(null);
    try {
      const result = await analyzeDashboardMetrics(data);
      setInsight(result);
    } catch (error) {
      alert("Erro ao processar insight de IA.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = () => {
    if (!insight) return;
    navigator.clipboard.writeText(insight);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const InfoIcon = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-2 z-10">
      <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-600 text-[9px] font-black text-slate-500 cursor-help group-hover:border-emerald-500 group-hover:text-emerald-500 transition-colors">
        i
      </div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 bg-slate-900 border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none text-left">
        <p className="text-[9px] leading-relaxed text-slate-300 font-medium normal-case tracking-normal">
          {text}
        </p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
      </div>
    </div>
  );

  const StatCard = ({ label, value, subValue, tooltip, color = "emerald", alert = false }: any) => (
    <div className={`bg-[#0f172a] border ${alert ? 'border-rose-500/30' : 'border-white/5'} p-6 rounded-[2rem] shadow-xl hover:border-white/10 transition-all relative overflow-visible`}>
      <div className="flex justify-between items-start mb-2">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
        <InfoIcon text={tooltip} />
      </div>
      <div className="flex items-baseline gap-2">
        <h3 className={`text-3xl font-black italic tracking-tighter ${alert ? 'text-rose-500 animate-pulse' : `text-${color}-400`}`}>{value}</h3>
        {subValue && <span className="text-[10px] text-slate-500 font-bold uppercase">{subValue}</span>}
      </div>
    </div>
  );

  const SectionHeader = ({ title, subtitle, icon: Icon, color }: any) => (
    <div className="flex items-center gap-3 mb-6 mt-8 border-b border-white/5 pb-2">
      <div className={`p-2 rounded-lg bg-${color}-500/10 text-${color}-500`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="text-sm font-black text-white uppercase tracking-tight">{title}</h3>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{subtitle}</p>
      </div>
    </div>
  );

  const MetricCard = ({ label, value, unit, status, description, icon: Icon }: any) => {
    const statusColor = status === 'good' ? 'text-emerald-500' : status === 'warning' ? 'text-amber-500' : 'text-rose-500';
    const bgStatus = status === 'good' ? 'bg-emerald-500/5 border-emerald-500/10' : status === 'warning' ? 'bg-amber-500/5 border-amber-500/10' : 'bg-rose-500/5 border-rose-500/10';

    return (
      <div className={`p-5 rounded-3xl border transition-all ${bgStatus}`}>
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-black/20 rounded-xl">
             <Icon className={`w-4 h-4 ${statusColor}`} />
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest ${statusColor}`}>{status === 'good' ? 'Saudável' : status === 'warning' ? 'Atenção' : 'Crítico'}</span>
        </div>
        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">{label}</p>
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-2xl font-black text-white tracking-tighter">{value}</span>
          <span className="text-xs text-slate-500 font-bold">{unit}</span>
        </div>
        <p className="text-[9px] text-slate-500 leading-tight">{description}</p>
      </div>
    );
  };

  if (!data) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
        <div className="flex items-center gap-4">
          <div className="h-10 w-1.5 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight italic">
              {userRole === 'OWNER' ? 'Master Dashboard Governance' : 'Painel Executivo HunterMatch'}
            </h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Real-time Telemetry & Business Intelligence</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={handleAIInsight}
            disabled={isAnalyzing}
            className={`group relative flex items-center gap-3 px-8 py-3 rounded-full font-black uppercase text-[11px] tracking-widest transition-all shadow-2xl overflow-hidden ${isAnalyzing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 active:scale-95'}`}
          >
            {isAnalyzing && <div className="absolute inset-0 bg-white/10 animate-pulse"></div>}
            <svg className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="relative z-10">{isAnalyzing ? 'Analisando Estratégia...' : 'Gerar Insight de IA'}</span>
          </button>
        </div>
      </div>

      {/* IA Insight Panel */}
      {insight && (
        <div className="bg-gradient-to-b from-slate-900 to-[#0f172a] border border-emerald-500/20 rounded-[2.5rem] p-8 animate-in slide-in-from-top-4 duration-500 shadow-2xl relative overflow-hidden mb-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 shadow-inner">
                <Zap className="w-5 h-5" />
              </div>
              <p className="text-[11px] font-black text-emerald-500 uppercase tracking-widest">Executive Intelligence Briefing</p>
            </div>
            <div className="flex gap-2">
              <button onClick={copyToClipboard} className={`p-2.5 rounded-xl border border-white/5 transition-all flex items-center gap-2 text-[10px] font-black uppercase ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}>{copied ? 'Copiado' : 'Copiar'}</button>
              <button onClick={() => setInsight(null)} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-white border border-white/5 rounded-xl transition-all"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="bg-black/20 p-6 rounded-2xl border border-white/5 backdrop-blur-sm"><div className="text-slate-300 text-sm font-medium leading-relaxed whitespace-pre-wrap">{insight}</div></div>
        </div>
      )}

      {/* Global Stats - Mantido conforme solicitação */}
      {userRole === 'OWNER' && globalStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Usuários" value={globalStats.totalUsers} color="emerald" tooltip="Volume total de UIDs na plataforma." />
          <StatCard label="Job Hunters" value={globalStats.totalHunters} color="blue" tooltip="Células de venda e mentoria ativas." />
          <StatCard label="Clientes Ativos" value={globalStats.totalClients} color="indigo" tooltip="Candidatos em busca ativa." />
          <StatCard label="Auditorias Globais" value={globalStats.totalAudits} color="amber" tooltip="Processamento total via Gemini." />
          <StatCard label="Mentoria REBAC" value={globalStats.totalMentorships} color="rose" tooltip="Relações estabelecidas via REBAC." />
        </div>
      )}

      {/* SEÇÃO 1: DIÁRIO (OPERACIONAL) */}
      {userRole === 'OWNER' && (
        <div className="space-y-4 animate-slide delay-100">
          <SectionHeader title="Monitoramento Diário" subtitle="Operacional & Saúde (CTO View)" icon={Activity} color="emerald" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard 
              label="Taxa de Erro (Error Rate)" 
              value={data.daily.errorRate} 
              unit="%" 
              status={data.daily.errorRate < 1 ? 'good' : 'bad'} 
              icon={AlertTriangle}
              description="Falhas em requisições (5xx/4xx). Impacto imediato na confiança."
            />
            <MetricCard 
              label="Latência (P95)" 
              value={data.daily.latencyP95} 
              unit="ms" 
              status={data.daily.latencyP95 < 5000 ? 'good' : 'warning'} 
              icon={Clock}
              description="Tempo de resposta para os 5% de usuários mais lentos."
            />
            <MetricCard 
              label="Usuários Ativos (DAU)" 
              value={data.daily.dau} 
              unit="Users" 
              status="good" 
              icon={Users}
              description="Pulsação diária do produto. Usuários únicos em 24h."
            />
          </div>
        </div>
      )}

      {/* SEÇÃO 2: SEMANAL (TÁTICO) */}
      {userRole === 'OWNER' && (
        <div className="space-y-4 animate-slide delay-200">
          <SectionHeader title="Monitoramento Semanal" subtitle="Tático & Engajamento (PM View)" icon={TrendingUp} color="amber" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <MetricCard 
              label="Feature Adoption" 
              value={data.weekly.featureAdoption} 
              unit="%" 
              status={data.weekly.featureAdoption > 30 ? 'good' : 'warning'} 
              icon={Zap}
              description="Usuários utilizando features novas lançadas recentemente."
            />
            <MetricCard 
              label="Stickiness (DAU/MAU)" 
              value={data.weekly.stickiness} 
              unit="%" 
              status={data.weekly.stickiness > 20 ? 'good' : 'warning'} 
              icon={Heart}
              description="Frequência de retorno. Indica formação de hábito."
            />
            <MetricCard 
              label="MTTR (Mean Time to Repair)" 
              value={data.weekly.mttr} 
              unit="hrs" 
              status={data.weekly.mttr < 4 ? 'good' : 'bad'} 
              icon={ShieldCheck}
              description="Tempo médio para resolver incidentes críticos."
            />
          </div>
        </div>
      )}

      {/* SEÇÃO 3: MENSAL (ESTRATÉGICO) */}
      {userRole === 'OWNER' && (
        <div className="space-y-4 animate-slide delay-300">
          <SectionHeader title="Monitoramento Mensal" subtitle="Estratégico & Financeiro (CEO View)" icon={DollarSign} color="indigo" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard 
              label="Churn Rate" 
              value={data.monthly.churnRate} 
              unit="%" 
              status={data.monthly.churnRate < 3 ? 'good' : 'bad'} 
              icon={AlertTriangle}
              description="Velocidade de perda de clientes. Vital para sustentabilidade."
            />
            <MetricCard 
              label="LTV:CAC Ratio" 
              value={data.monthly.ltvCacRatio} 
              unit=":1" 
              status={data.monthly.ltvCacRatio >= 3 ? 'good' : 'warning'} 
              icon={TrendingUp}
              description="Saúde financeira. Ideal é 3:1 (Cliente vale 3x o custo)."
            />
            <MetricCard 
              label="NPS Score" 
              value={data.monthly.nps} 
              unit="pts" 
              status={data.monthly.nps > 50 ? 'good' : 'warning'} 
              icon={Heart}
              description="Lealdade e satisfação. Indicador antecedente de Churn."
            />
          </div>
        </div>
      )}

      {/* GRÁFICOS ORIGINAIS (MANTIDOS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-12">
        <div className="lg:col-span-2 bg-[#0f172a] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative">
          <div className="flex justify-between items-center mb-8">
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Global Ops Heatmap</p>
            <span className="text-[10px] text-slate-500 font-bold">AVG: $0.058/hr</span>
          </div>
          <div className="h-[250px] w-full" style={{ minHeight: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.cloudCostHourly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="hour" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '1rem' }}
                  itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="cost" stroke="#10b981" fillOpacity={1} fill="url(#colorCost)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2rem]">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">FinOps Summary</p>
            <div className="flex justify-between items-end">
               <div>
                 <h4 className="text-2xl font-black text-white italic">${data.geminiUsage.cost}</h4>
                 <p className="text-[9px] text-slate-500 uppercase font-bold">{data.geminiUsage.tokens.toLocaleString()} Tokens Processed</p>
               </div>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2rem]">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Quality Metrics</p>
            <div className="flex gap-4">
              <div className="flex-1">
                <span className="text-[9px] font-black text-emerald-500 uppercase">Coerência</span>
                <p className="text-xl font-black text-white">{data.agentCoherence}%</p>
              </div>
              <div className="flex-1">
                <span className="text-[9px] font-black text-rose-500 uppercase">Erro de IA</span>
                <p className="text-xl font-black text-white">{data.botErrorRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center py-6 opacity-20">
        <p className="text-[9px] text-slate-600 uppercase tracking-widest font-black italic">HunterMatch PRO • Enterprise Governance v5.4</p>
      </div>
    </div>
  );
};

export default Dashboard;
// Auxiliar import para ícone X que não estava importado
function X(props: any) {
  return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
}