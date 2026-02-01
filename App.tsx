
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AnalysisInputType, AnalysisState, HistoryItem, AnalysisResult } from './types';
import { analyzeJobContext } from './services/geminiService';
import AnalysisResults from './components/AnalysisResults';
import AnalysisHistory from './components/AnalysisHistory';

const DEFAULT_PROFILE = `=== MEU PERFIL PROFISSIONAL (MODELO) ===

Resumo: [Descreva aqui seu resumo profissional, anos de experiência e principais conquistas]

Objetivo: [Qual cargo você busca? Ex: Gerente de Projetos, Desenvolvedor Fullstack Sênior]

Hard Skills:
- [Habilidade 1]
- [Habilidade 2]
- [Tecnologias que domina]

Soft Skills:
- [Habilidade comportamental 1]
- [Liderança, comunicação, etc]

Idiomas:
- Inglês: [Ex: Intermediário - Lê e escreve bem, conversação em desenvolvimento]
- [Outro idioma]

Critérios Específicos para Match:
- Se a vaga exigir [Habilidade Crucial] e eu não tiver, reduza o score significativamente.
- Priorize modelos de trabalho [Remoto/Híbrido/Presencial].
- Se a vaga exigir inglês fluente e meu nível for inferior, penalizar o score em 50%.`;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'profile' | 'history'>('audit');
  const [inputType, setInputType] = useState<AnalysisInputType>('url');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [imageInput, setImageInput] = useState<string | null>(null);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<HistoryItem | null>(null);
  
  const [profileContent, setProfileContent] = useState(() => 
    localStorage.getItem('hunter_match_profile') || DEFAULT_PROFILE
  );
  
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('hunter_match_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [state, setState] = useState<AnalysisState>({
    isLoading: false,
    error: null,
    result: null,
  });

  // Salva perfil com debounce para evitar lag na digitação
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('hunter_match_profile', profileContent);
    }, 800);
    return () => clearTimeout(timer);
  }, [profileContent]);

  // Salva histórico
  useEffect(() => {
    localStorage.setItem('hunter_match_history', JSON.stringify(history));
  }, [history]);

  // Limpa sub-view ao mudar de aba
  useEffect(() => {
    if (activeTab !== 'history') setViewingHistoryItem(null);
  }, [activeTab]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Otimização: Limite de tamanho de imagem antes de processar base64 pesado
    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem é muito grande. Use um print menor que 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageInput(reader.result as string);
      e.target.value = ""; 
    };
    reader.readAsDataURL(file);
  }, []);

  const handleAnalyze = async () => {
    if (state.isLoading) return;

    // Reset de estado e erro para nova análise limpa
    setState({ isLoading: true, error: null, result: null });

    try {
      const currentInput = inputType === 'url' ? urlInput : inputType === 'text' ? textInput : imageInput;
      if (!currentInput) throw new Error(`Forneça o ${inputType === 'url' ? 'link' : inputType === 'text' ? 'texto' : 'print'} da vaga.`);

      // CHAMADA DA IA
      const result = await analyzeJobContext(currentInput, inputType, profileContent);

      const historyItem: HistoryItem = {
        ...result,
        id: crypto.randomUUID(),
        timestamp: Date.now()
      };
      
      setHistory(prev => [historyItem, ...prev]);
      setState({ isLoading: false, error: null, result });

      // LIMPEZA AGRESSIVA DE MEMÓRIA (Essencial para não travar na 2ª vez)
      if (inputType === 'image') setImageInput(null);
      setUrlInput('');
      setTextInput('');
      
    } catch (error: any) {
      setState({ isLoading: false, error: error.message || "Erro na Engine de IA", result: null });
    }
  };

  const deleteHistoryItem = useCallback((id: string) => {
    if (window.confirm('Excluir este registro permanentemente?')) {
      setHistory(prev => prev.filter(item => item.id !== id));
      if (viewingHistoryItem?.id === id) setViewingHistoryItem(null);
    }
  }, [viewingHistoryItem]);

  const selectHistoryItem = useCallback((item: HistoryItem) => {
    setViewingHistoryItem(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-[#060b18] text-slate-200 pb-20">
      <header className="bg-[#0a1224]/90 backdrop-blur-xl border-b border-white/5 px-6 py-4 sticky top-0 z-50 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center font-black text-white shadow-lg shadow-emerald-500/20 text-xl">H</div>
          <div>
            <h1 className="text-sm font-black text-white leading-none uppercase tracking-tighter">HunterMatch <span className="text-emerald-400">PRO</span></h1>
            <p className="text-[9px] text-emerald-500/60 font-black uppercase tracking-[0.2em] mt-1">Turbo Intelligence</p>
          </div>
        </div>
        
        <nav className="flex bg-slate-900/60 p-1 rounded-2xl border border-white/5">
          {(['audit', 'history', 'profile'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {tab === 'audit' ? 'Auditar' : tab === 'history' ? 'Histórico' : 'Meu Perfil'}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-12">
        {activeTab === 'profile' && (
          <div className="animate-slide">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-white tracking-tighter italic">CONFIGURAÇÃO ESTRATÉGICA</h2>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/5 rounded-full border border-emerald-500/10">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">Sincronizado</span>
              </div>
            </div>
            <div className="bg-[#0f172a] border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
              <textarea 
                value={profileContent}
                onChange={(e) => setProfileContent(e.target.value)}
                className="w-full h-[65vh] bg-transparent p-10 text-slate-400 font-mono text-sm leading-relaxed focus:outline-none focus:text-slate-200 transition-colors resize-none scrollbar-thin"
                placeholder="Cole seu currículo, experiências e as regras de negócio para o match aqui..."
              />
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-8 animate-slide">
            {viewingHistoryItem ? (
              <div className="space-y-6">
                <button 
                  onClick={() => setViewingHistoryItem(null)}
                  className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 hover:text-emerald-400 transition-all group"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                  </div>
                  Voltar para o histórico
                </button>
                <div className="bg-[#0f172a] border border-white/5 rounded-[3rem] p-10 shadow-2xl">
                  <AnalysisResults result={viewingHistoryItem} />
                </div>
              </div>
            ) : (
              <AnalysisHistory 
                history={history} 
                onDelete={deleteHistoryItem} 
                onSelect={selectHistoryItem} 
              />
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="max-w-3xl mx-auto animate-slide">
            <div className="text-center mb-12">
              <h2 className="text-5xl font-black text-white mb-4 tracking-tighter italic">NOVA AUDITORIA</h2>
              <p className="text-slate-500 text-sm font-medium tracking-wide">Compare vagas com o seu perfil em menos de 10 segundos.</p>
            </div>

            <div className="bg-[#0f172a] border border-white/5 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
              <div className="flex gap-2 mb-10 bg-slate-900/80 p-1.5 rounded-2xl border border-white/5">
                {(['url', 'text', 'image'] as AnalysisInputType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setInputType(type)}
                    className={`flex-1 py-3.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${inputType === type ? 'bg-slate-800 text-emerald-400 shadow-inner' : 'text-slate-500 hover:text-slate-400'}`}
                  >
                    {type === 'url' ? '🔗 Link' : type === 'text' ? '📝 Texto' : '🖼️ Imagem'}
                  </button>
                ))}
              </div>

              <div className="space-y-8">
                {inputType === 'url' && (
                  <input 
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Cole o link da vaga (LinkedIn, Gupy, etc...)"
                    className="w-full bg-[#161f32] border border-white/5 rounded-2xl px-8 py-6 text-white placeholder:text-slate-700 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all text-sm font-mono shadow-inner"
                  />
                )}

                {inputType === 'text' && (
                  <textarea 
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Cole a descrição da vaga aqui..."
                    className="w-full h-56 bg-[#161f32] border border-white/5 rounded-2xl p-8 text-white placeholder:text-slate-700 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all resize-none text-sm leading-relaxed shadow-inner"
                  />
                )}

                {inputType === 'image' && (
                  <div className="border-2 border-dashed border-white/5 rounded-[2rem] p-16 bg-slate-900/40 text-center relative hover:border-emerald-500/30 transition-all group overflow-hidden">
                    {!imageInput ? (
                      <>
                        <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
                        <div className="flex flex-col items-center gap-5">
                          <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                            <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                          <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Solte o print da vaga</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center">
                        <img src={imageInput} className="max-h-64 rounded-2xl border border-white/10 shadow-2xl mb-8 animate-in fade-in zoom-in-95" />
                        <button onClick={() => setImageInput(null)} className="px-8 py-3 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase rounded-full hover:bg-rose-500 hover:text-white transition-all tracking-widest">Remover e trocar</button>
                      </div>
                    )}
                  </div>
                )}

                <button 
                  onClick={handleAnalyze}
                  disabled={state.isLoading}
                  className={`w-full py-7 rounded-[2rem] font-black uppercase tracking-[0.5em] text-[12px] transition-all relative overflow-hidden ${state.isLoading ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-3xl shadow-emerald-500/20 active:scale-[0.98]'}`}
                >
                  {state.isLoading ? (
                    <span className="flex items-center justify-center gap-4">
                      <svg className="animate-spin h-5 w-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      PROCESSANDO AUDITORIA...
                    </span>
                  ) : 'AUDITAR AGORA'}
                </button>
              </div>

              {state.error && (
                <div className="mt-8 p-6 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-rose-400 text-[10px] font-black uppercase tracking-widest text-center animate-pulse">
                  Erro detectado: {state.error}
                </div>
              )}
            </div>

            {state.result && <div className="mt-12"><AnalysisResults result={state.result} /></div>}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
