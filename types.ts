
export interface AnalysisResult {
  jobTitle: string;
  company: string;
  location: string;
  workModel: 'Presencial' | 'Híbrido' | 'Remoto' | 'Não especificado';
  matchScore: number;
  connections: string;
  gaps: string;
  interviewPitch: string;
  adequacySummary: string;
  requiresFluentEnglish: boolean;
  rawJobDescription?: string;
}

export interface HistoryItem extends AnalysisResult {
  id: string;
  timestamp: number;
}

export type AnalysisInputType = 'text' | 'image' | 'url';

export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
  result: AnalysisResult | null;
}
