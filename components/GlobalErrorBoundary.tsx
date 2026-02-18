import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    // Atualiza o state para que a próxima renderização mostre a UI alternativa.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Registra o erro e a stack de componentes no estado para renderização
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#060b18] p-6 text-center animate-in fade-in duration-300">
          <div className="max-w-xl w-full bg-rose-950/20 border border-rose-500/30 rounded-[2.5rem] p-12 shadow-2xl backdrop-blur-sm">
            
            <h1 className="text-3xl font-black text-rose-500 uppercase italic mb-4 tracking-tight">
              Algo deu errado no sistema
            </h1>
            
            <p className="text-slate-400 mb-8 font-medium">
              Detectamos um conflito de execução.
            </p>
            
            <div className="bg-black/40 p-6 rounded-2xl border border-rose-500/20 text-left overflow-auto max-w-full mb-8 max-h-96 custom-scrollbar">
              <pre className="text-[10px] font-mono leading-relaxed whitespace-pre-wrap break-all">
                <span className="text-rose-400 block mb-4 border-b border-rose-500/10 pb-4 font-bold">
                    {this.state.error?.toString() || "Erro desconhecido"}
                </span>
                {this.state.errorInfo?.componentStack && (
                    <span className="text-slate-500 opacity-80">
                        {"> Component Stack Trace:"}
                        {this.state.errorInfo.componentStack}
                    </span>
                )}
              </pre>
            </div>
            
            <button 
              onClick={() => window.location.reload()}
              className="px-10 py-4 bg-rose-600 text-white font-black uppercase text-[11px] rounded-2xl hover:bg-rose-500 transition-all shadow-xl shadow-rose-600/20 active:scale-95 cursor-pointer"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}