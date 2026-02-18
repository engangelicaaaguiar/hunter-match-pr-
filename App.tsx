import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  AnalysisInputType, AnalysisState, HistoryItem, 
  UserProfile, UserRole 
} from './types';
import { analyzeJobContext, consolidateProfileFromFiles } from './services/geminiService';
import { storage, AuditLogEntry } from './services/storageService';
import AnalysisResults from './components/AnalysisResults';
import AnalysisHistory from './components/AnalysisHistory';
import Dashboard from './components/Dashboard';
import { Loader2, UploadCloud, X, FileText, Sparkles, Bell } from 'lucide-react';

const DEFAULT_PROFILE = `=== MEU PERFIL ESTRATÉGICO CONSOLIDADO ===\nNome: [Seu Nome]\nExperiência: [Descreva suas experiências e resumo profissional aqui para a IA usar no Match]`;

// Safe UUID generator
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'audit' | 'history' | 'profile' | 'dashboard'>('audit');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [profileContent, setProfileContent] = useState(DEFAULT_PROFILE);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [inputType, setInputType] = useState<AnalysisInputType>('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [imageInput, setImageInput] = useState<string | null>(null);
  
  // Profile File Upload State
  const [profileFiles, setProfileFiles] = useState<File[]>([]);
  const [isProcessingProfile, setIsProcessingProfile] = useState(false);
  
  // State for analysis
  const [state, setState] = useState<AnalysisState>({ isLoading: false, error: null, result: null });
  
  // UI helpers
  const [progress, setProgress] = useState(0);
  const [showReaderHelp, setShowReaderHelp] = useState(false);
  const progressIntervalRef = useRef<number | null>(null);

  const startProgress = (isQuick = true) => {
    setProgress(0);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) return 98;
        return Math.min(prev + (prev < 50 ? (isQuick ? 15 : 8) : 2), 99);
      });
    }, isQuick ? 50 : 100);
  };

  const completeProgress = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 1000);
  };

  const loadContextData = useCallback(async (uid: string) => {
    try {
      const [savedProfile, savedHistory] = await Promise.all([
        storage.getProfile(uid),
        storage.getHistoryByClient(uid)
      ]);
      if (savedProfile) {
        setProfileContent(savedProfile);
        localStorage.setItem('hunter_match_profile', savedProfile);
      }
      setHistory(savedHistory.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error("Failed to load context data", error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const savedUid = localStorage.getItem('hunter_match_uid');
        if (savedUid) {
          const p = await storage.getUser(savedUid).catch(() => null); // Fail safe
          if (p) { 
            setUser(p); 
            await loadContextData(p.uid); 
          } else {
             // ID exists in localstorage but not in DB (corruption/clear). Reset.
             localStorage.removeItem('hunter_match_uid');
          }
        }
      } catch (err) {
        console.error("Critical initialization error:", err);
      } finally {
        // ALWAYS unblock the UI
        setIsDataLoaded(true);
      }
    };
    init();
  }, [loadContextData]);

  const activeAlertCount = useMemo(() => {
    if (!history) return 0;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    let count = 0;

    const isDismissed = (item: HistoryItem, type: string) => {
      if (!item.dismissedAlerts || !item.dismissedAlerts[type]) return false;
      return (now - item.dismissedAlerts[type]) < (7 * oneDay);
    };

    history.forEach(item => {
      if (!item.applied) return;
      const daysSinceApp = (now - item.timestamp) / oneDay;

      // Type 1: P0
      if (item.tier === 'P0_SNIPER' && item.applicationChannel === 'APPLY_ONLY' && (item.status === 'ENVIADA' || item.status === 'VISUALIZADA') && !isDismissed(item, 'P0_NO_OUTREACH')) count++;
      // Type 2: Followup
      else if (item.applicationChannel === 'APPLY_OUTREACH' && (!item.outreachResponse || item.outreachResponse === 'NONE') && daysSinceApp >= 5 && daysSinceApp <= 10 && !isDismissed(item, 'FOLLOWUP_PENDING')) count++;
      // Type 3: Timeout
      else if ((item.status === 'ENVIADA' || item.status === 'VISUALIZADA') && daysSinceApp >= 21 && !isDismissed(item, 'TIMEOUT')) count++;
      // Type 4: Interview
      else if (item.status === 'ENTREVISTA_AGENDADA' && item.statusHistory && ((now - item.statusHistory[item.statusHistory.length-1].timestamp) / oneDay >= 1) && !item.interviewImpression && !isDismissed(item, 'INTERVIEW_MISSING')) count++;
    });

    // Type 5: Systemic (Count as 1 if active)
    const last10Applied = history.filter(h => h.applied).slice(0, 10);
    if (last10Applied.length >= 5) {
        const advanced = last10Applied.filter(h => ['CONTATO', 'ENTREVISTA_AGENDADA', 'ENTREVISTA_REALIZADA', 'PROXIMA_FASE', 'OFERTA', 'ACEITA'].includes(h.status || ''));
        const conversion = (advanced.length / last10Applied.length);
        const dismissedSystemic = localStorage.getItem('hunter_systemic_alert_dismiss');
        if (conversion < 0.1 && (!dismissedSystemic || (now - parseInt(dismissedSystemic)) > 7 * oneDay)) count++;
    }

    return count;
  }, [history]);

  const logTelemetry = async (action: string, status: 'SUCCESS' | 'ERROR', usage?: any, errorDetails?: string) => {
    if (!user) return;
    try {
      const totalTokens = (usage?.promptTokenCount || 0) + (usage?.candidatesTokenCount || 0);
      const logEntry: AuditLogEntry = {
        id: generateUUID(),
        timestamp: Date.now(),
        uid: user.uid,
        action,
        status,
        tokensUsed: totalTokens,
        costEstimate: (totalTokens / 1000000) * 0.15, // Estimativa baseada no Gemini Flash
        details: errorDetails
      };
      await storage.addAuditLog(logEntry);
    } catch (e) {
      console.error("Falha ao salvar telemetria", e);
    }
  };

  const handlePaste = async (target: 'text' | 'url') => {
    try {
      const text = await navigator.clipboard.readText();
      if (target === 'text') setTextInput(text);
      else setUrlInput(text);
    } catch (err) {
      alert("Não foi possível ler a área de transferência. Verifique as permissões do navegador.");
    }
  };

  const handleAnalyze = async () => {
    if (state.isLoading || !user) return;
    if (!profileContent || profileContent === DEFAULT_PROFILE) {
      setState({ ...state, error: "⚠️ Por favor, preencha seu perfil na aba 'Perfil' primeiro." });
      setActiveTab('profile');
      return;
    }

    const input = inputType === 'text' ? textInput : inputType === 'url' ? urlInput : imageInput;
    if (!input) {
      setState({ ...state, error: "❌ Insira a vaga, o link ou a imagem." });
      return;
    }

    setState({ isLoading: true, error: null, result: null });
    startProgress(inputType === 'text');
    
    // Clear inputs immediately to allow new data insertion
    setTextInput('');
    setUrlInput('');
    setImageInput(null);
    
    try {
      const { result, usage } = await analyzeJobContext(input, inputType, profileContent);
      
      const historyItem: HistoryItem = { ...result, id: generateUUID(), timestamp: Date.now(), applied: false, clientId: user.uid };
      await storage.putHistoryItem(historyItem);
      
      // Log Success Telemetry
      await logTelemetry('ANALYZE_JOB', 'SUCCESS', usage);

      setHistory(prev => [historyItem, ...prev]);
      setState({ isLoading: false, error: null, result });
      completeProgress();
    } catch (e: any) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      
      // Log Error Telemetry
      await logTelemetry('ANALYZE_JOB', 'ERROR', undefined, e.message);

      setProgress(0);
      setState({ isLoading: false, error: e.message, result: null });
    }
  };

  const handleLogin = async (role: UserRole) => {
    const uid = generateUUID();
    const newUser = { uid, name: 'Usuário ' + role, email: role.toLowerCase() + '@hunterpro.com', role };
    await storage.saveCurrentUser(newUser);
    localStorage.setItem('hunter_match_uid', uid);
    setUser(newUser);
    await loadContextData(uid);
    setActiveTab(role === 'CLIENT' ? 'audit' : 'dashboard');
  };
  
  const handleLogout = () => {
    localStorage.removeItem('hunter_match_uid');
    setUser(null);
    setHistory([]);
    setProfileContent(DEFAULT_PROFILE);
    setState({ isLoading: false, error: null, result: null });
  };

  const saveProfile = async () => {
    if (!user) return;
    await storage.saveProfile(profileContent, user.uid);
    localStorage.setItem('hunter_match_profile', profileContent);
    alert("Perfil Mestre atualizado com sucesso!");
  };

  // --- Profile File Upload Logic ---
  const handleProfileFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files: File[] = Array.from(e.target.files);
      const validFiles = files.filter(f => f.type === 'application/pdf');
      
      if (validFiles.length !== files.length) {
        alert("Apenas arquivos PDF são permitidos.");
      }

      if (profileFiles.length + validFiles.length > 5) {
        alert("Você pode carregar no máximo 5 arquivos.");
        return;
      }

      setProfileFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeProfileFile = (index: number) => {
    setProfileFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processProfileFiles = async () => {
    if (profileFiles.length === 0) return;
    setIsProcessingProfile(true);

    try {
      // 1. Converter arquivos para Base64
      const filePromises = profileFiles.map(file => {
        return new Promise<{ data: string, mimeType: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              // Remove o prefixo "data:application/pdf;base64,"
              const base64 = reader.result.split(',')[1];
              resolve({ data: base64, mimeType: file.type });
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      const filesData = await Promise.all(filePromises);

      // 2. Chamar o serviço Gemini
      const consolidatedProfile = await consolidateProfileFromFiles(filesData, profileContent);
      
      // Log Success Telemetry (Estimation of tokens for files is hard, approximate)
      await logTelemetry('CONSOLIDATE_PROFILE', 'SUCCESS', { promptTokenCount: 1000 * filesData.length, candidatesTokenCount: 500 });

      // 3. Atualizar o estado
      setProfileContent(consolidatedProfile);
      setProfileFiles([]); // Limpa arquivos após sucesso
      alert("Perfil Mestre gerado com sucesso! Revise e edite conforme necessário.");
    } catch (error: any) {
      console.error("Erro ao processar currículos:", error);
      await logTelemetry('CONSOLIDATE_PROFILE', 'ERROR', undefined, error.message);
      alert("Ocorreu um erro ao processar seus arquivos. Tente novamente.");
    } finally {
      setIsProcessingProfile(false);
    }
  };

  const bookmarkletCode = `javascript:(function(){const t=window.getSelection().toString()||document.body.innerText;const u=window.location.href;const msg="=== DADOS DA VAGA CAPTURADOS ===\\nURL: "+u+"\\n\\nCONTEÚDO:\\n"+t;navigator.clipboard.writeText(msg).then(()=>{alert('✅ Vaga Copiada!\\n\\nVolte ao HunterMatch e use o botão \\"Colar\\" na aba de Texto.');}).catch(e=>{alert('Erro ao copiar: '+e)});})();`;

  if (!isDataLoaded) return <div className="min-h-screen bg-[#060b18] flex items-center justify-center text-emerald-500 font-black">CARREGANDO SISTEMA...</div>;

  if (!user) return (
    <div className="min-h-screen bg-[#060b18] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#0f172a] rounded-[3rem] p-12 text-center border border-white/5 shadow-2xl animate-slide">
        <div className="w-16 h-16 bg-emerald-600 rounded-3xl mx-auto mb-8 flex items-center justify-center font-black text-2xl text-white shadow-[0_0_30px_rgba(16,185,129,0.3)]">H</div>
        <h2 className="text-3xl font-black text-white italic uppercase mb-2 tracking-tighter">HunterMatch PRO</h2>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-10">Inteligência Estratégica para Carreira</p>
        <div className="space-y-4">
          <button onClick={() => handleLogin('CLIENT')} className="w-full py-5 bg-white text-black font-black uppercase text-[11px] rounded-2xl hover:bg-emerald-400 transition-all">Perfil Candidato</button>
          <button onClick={() => handleLogin('HUNTER')} className="w-full py-5 bg-slate-800 text-white font-black uppercase text-[11px] rounded-2xl hover:bg-slate-700 transition-all">Perfil Job Hunter</button>
          <button onClick={() => handleLogin('OWNER')} className="w-full py-5 border border-white/10 text-white font-black uppercase text-[11px] rounded-2xl hover:bg-white/5 transition-all">Owner / Admin</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060b18] text-slate-200">
      <header className="bg-[#0a1224]/90 backdrop-blur-xl border-b border-white/5 px-6 py-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center font-black text-white">H</div>
          <h1 className="text-sm font-black uppercase text-white tracking-tight">HunterMatch <span className="text-emerald-400">PRO</span></h1>
        </div>
        <nav className="flex gap-2 bg-slate-900/60 p-1 rounded-2xl">
          {user.role === 'CLIENT' && (
            <>
              <button onClick={() => setActiveTab('audit')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'audit' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>Auditoria</button>
              <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>
                Histórico
                {activeAlertCount > 0 && (
                  <span className="flex items-center justify-center bg-rose-500 text-white text-[9px] w-5 h-5 rounded-full font-bold shadow-lg animate-pulse">
                    {activeAlertCount}
                  </span>
                )}
              </button>
              <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'profile' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>Perfil</button>
            </>
          )}
          {(user.role === 'HUNTER' || user.role === 'OWNER') && (
            <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>Dashboard</button>
          )}
          <button onClick={handleLogout} className="px-4 py-2 text-[10px] font-black uppercase rounded-xl text-rose-500 hover:bg-rose-500/10">Sair</button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'audit' && (
          <div className="animate-slide max-w-4xl mx-auto">
            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter text-center mb-4">Auditoria de Vaga</h2>
            <p className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest mb-10">Análise de Match em tempo real</p>
            
            <div className="bg-[#0f172a] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl mb-12 relative">
              <div className="flex gap-2 mb-8 bg-slate-900/80 p-1.5 rounded-2xl">
                {(['text', 'url', 'image'] as AnalysisInputType[]).map(type => (
                  <button key={type} onClick={() => setInputType(type)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${inputType === type ? 'bg-slate-800 text-emerald-400' : 'text-slate-500'}`}>{type === 'text' ? 'Texto' : type === 'url' ? 'Link' : 'Screenshot'}</button>
                ))}
              </div>
              
              {inputType === 'text' && (
                <div className="relative space-y-4">
                  <div className="flex justify-end">
                    <button onClick={() => setShowReaderHelp(!showReaderHelp)} className="text-[10px] font-black uppercase text-emerald-500 hover:text-emerald-400 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Instalar Web Reader
                    </button>
                  </div>
                  
                  {showReaderHelp && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl animate-in fade-in slide-in-from-top-2">
                      <h4 className="text-sm font-black text-white uppercase mb-2">Instalar Leitor de Vagas (Bookmarklet)</h4>
                      <p className="text-xs text-slate-300 mb-4">Arraste o botão abaixo para sua barra de favoritos do navegador. Quando estiver na página de uma vaga, clique nele para copiar tudo automaticamente.</p>
                      <a href={bookmarkletCode} className="inline-block px-4 py-2 bg-emerald-600 text-white font-black text-[10px] uppercase rounded-lg hover:bg-emerald-500 cursor-grab active:cursor-grabbing border-2 border-dashed border-white/30" onClick={e => e.preventDefault()}>
                        ⚡ HunterMatch Reader
                      </a>
                    </div>
                  )}

                  <div className="relative">
                    <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Cole o texto completo da vaga (CTRL+V)..." className="w-full h-48 bg-slate-900/60 border border-white/5 rounded-2xl p-6 text-white text-sm resize-none focus:border-emerald-500/30 outline-none transition-all" />
                    <button onClick={() => handlePaste('text')} className="absolute top-4 right-4 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-500 text-[9px] font-black uppercase rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      Colar
                    </button>
                  </div>
                </div>
              )}
              {inputType === 'url' && (
                <div className="relative">
                  <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://linkedin.com/jobs/view/..." className="w-full bg-slate-900/60 border border-white/5 rounded-2xl p-6 pr-40 text-white text-sm outline-none focus:border-emerald-500/30 transition-all" />
                  <button onClick={() => handlePaste('url')} className="absolute top-1/2 -translate-y-1/2 right-4 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-500 text-[9px] font-black uppercase rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2">
                     <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    Colar Link da Vaga
                  </button>
                </div>
              )}
              {inputType === 'image' && (
                <div className="border-2 border-dashed border-white/10 rounded-[2rem] p-12 bg-slate-900/40 text-center relative group hover:border-emerald-500/30 transition-all">
                  {!imageInput ? <><input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onloadend = () => setImageInput(r.result as string); r.readAsDataURL(f); } }} className="absolute inset-0 opacity-0 cursor-pointer" /><p className="text-[11px] font-black uppercase text-slate-500">Clique ou arraste a imagem da vaga</p></> : <div className="relative inline-block"><img src={imageInput} className="max-h-56 mx-auto rounded-xl shadow-2xl" /><button onClick={() => setImageInput(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center font-bold">×</button></div>}
                </div>
              )}

              {state.error && <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase rounded-xl">{state.error}</div>}

              <button onClick={handleAnalyze} disabled={state.isLoading} className={`w-full mt-8 py-5 rounded-[2.5rem] font-black uppercase text-[11px] transition-all shadow-xl ${state.isLoading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-[1.01] active:scale-95'}`}>
                {state.isLoading ? `PROCESSANDO AUDITORIA... ${progress}%` : 'INICIAR ANÁLISE ESTRATÉGICA'}
              </button>
            </div>
            {state.result && <AnalysisResults result={state.result} />}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="animate-slide max-w-4xl mx-auto">
            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter text-center mb-4">Perfil Mestre</h2>
            <p className="text-center text-slate-500 text-xs font-bold uppercase tracking-widest mb-10">Dados base para o cruzamento da IA</p>
            <div className="bg-[#0f172a] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl">
              
              {/* PDF Upload Section */}
              <div className="mb-10 bg-slate-900/40 border-2 border-dashed border-white/10 rounded-3xl p-8 hover:border-emerald-500/30 transition-all group">
                <div className="flex flex-col items-center justify-center text-center">
                   <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                     <UploadCloud className="w-6 h-6 text-emerald-500" />
                   </div>
                   <h3 className="text-sm font-black text-white uppercase mb-2">Importar Currículos (PDF)</h3>
                   <p className="text-[10px] text-slate-500 mb-6 max-w-md">Carregue até 5 arquivos PDF. Nossa IA lerá todos, extrairá suas experiências e consolidará um Perfil Mestre completo abaixo.</p>
                   
                   <label className={`cursor-pointer px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg ${isProcessingProfile ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input 
                        type="file" 
                        accept="application/pdf" 
                        multiple 
                        onChange={handleProfileFileSelect} 
                        disabled={isProcessingProfile}
                        className="hidden" 
                      />
                      {isProcessingProfile ? 'Processando...' : 'Selecionar Arquivos'}
                   </label>
                </div>

                {/* File List */}
                {profileFiles.length > 0 && (
                  <div className="mt-8 space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5">
                     {profileFiles.map((file, idx) => (
                       <div key={idx} className="flex items-center justify-between bg-white/5 px-4 py-3 rounded-xl border border-white/5">
                         <div className="flex items-center gap-3">
                           <FileText className="w-4 h-4 text-emerald-500" />
                           <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">{file.name}</span>
                           <span className="text-[9px] text-slate-600 uppercase font-bold">{(file.size / 1024).toFixed(0)}KB</span>
                         </div>
                         {!isProcessingProfile && (
                           <button onClick={() => removeProfileFile(idx)} className="text-rose-500 hover:text-rose-400 p-1">
                             <X className="w-4 h-4" />
                           </button>
                         )}
                       </div>
                     ))}
                     
                     <button 
                       onClick={processProfileFiles}
                       disabled={isProcessingProfile}
                       className="w-full mt-4 py-4 bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                     >
                       {isProcessingProfile ? (
                         <><Loader2 className="w-4 h-4 animate-spin" /> Analisando Documentos com IA...</>
                       ) : (
                         <><Sparkles className="w-4 h-4 text-emerald-600" /> Gerar Perfil Unificado com IA</>
                       )}
                     </button>
                  </div>
                )}
              </div>

              <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4">Resumo Profissional / Currículo Base (Editável)</label>
              <textarea 
                value={profileContent} 
                onChange={e => setProfileContent(e.target.value)} 
                className="w-full h-96 bg-slate-900/60 border border-white/5 rounded-2xl p-6 text-white text-sm font-mono focus:border-emerald-500/30 outline-none transition-all mb-8"
              />
              <button onClick={saveProfile} className="w-full py-5 bg-emerald-600 text-white font-black uppercase text-[11px] rounded-2xl hover:bg-emerald-500 transition-all">Salvar Perfil Mestre</button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <AnalysisHistory 
            history={history} 
            onDelete={id => { storage.getAllHistory().then(all => { const filtered = all.filter(x => x.id !== id); storage.putHistoryItem(filtered as any); setHistory(filtered); }); }} 
            onSelect={item => { setState({ isLoading: false, error: null, result: item }); setActiveTab('audit'); }}
            onUpdateItem={async (updatedItem) => {
              const updatedHistory = history.map(item => item.id === updatedItem.id ? updatedItem : item);
              setHistory(updatedHistory);
              await storage.putHistoryItem(updatedItem);
            }}
          />
        )}

        {activeTab === 'dashboard' && <Dashboard userRole={user.role} />}
      </main>
    </div>
  );
};

export default App;