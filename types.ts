
export type UserRole = 'CLIENT' | 'HUNTER' | 'OWNER';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  mentorId?: string;
}

export interface InviteCode {
  id: string;
  code: string;
  role: UserRole;
  used: boolean;
  usedBy?: string;
  createdAt: number;
}

// === NOVAS ESTRUTURAS DO BLUEPRINT V2.0 ===

export interface ParsedJobFields {
  jobTitle: string;
  company: string;
  sector: string;
  seniority: string;
  coreFunction: string;
  workModel: string;
  location: string;
  salaryRange: string;
  requiredLanguages: string[];
  topKeywords: string[];
  mandatoryTools: string[];
  dealBreakers: string[];
}

export interface DimensionScores {
  technicalCompetence: number;
  sectorDomain: number;
  seniorityFit: number;
  languageFit: number;
  locationFit: number;
  salaryFit: number;
  stackFit: number;
}

export interface ActionProtocol {
  label: string; // Ex: "CANDIDATAR COM FORÇA TOTAL"
  checklist: string[];
  estimatedTime: string;
}

export interface ConversionProbability {
  percentage: number;
  positiveFactors: string[];
  riskFactors: string[];
}

export interface Multiplier {
  type: 'BOOST' | 'PENALTY';
  percentage: number;
  reason: string;
}

export interface DealBreakerInfo {
  activated: boolean;
  capApplied: number;
  reason: string | null;
}

export interface AnalysisResult {
  // Campos Mantidos (Compatibilidade v1)
  jobTitle: string;
  company: string;
  location: string;
  workModel: 'Presencial' | 'Híbrido' | 'Remoto' | 'Não especificado';
  matchScore: number;
  connections: string; // Agora formatado com 3 itens específicos
  gaps: string; // Agora formatado com severidade e mitigação
  jobSummary: string;
  dayToDayScenario: string; 
  salarySpecific: string;   
  adequacySummary: string;
  candidateTrajectorySummary: string; // Executive Summary / Branding Statement
  salaryReputation: string;
  requiresFluentEnglish: boolean;
  positioningDiagnosis: {
    overqualified: string;
    perfect: string;
    noise: string;
  };
  narrativeOptimization: string;
  mindsetStrategy: string;
  rawJobDescription?: string;
  jobUrl?: string;

  // Novos Campos v2.0
  parsedFields?: ParsedJobFields;
  dimensionScores?: DimensionScores;
  rawWeightedScore?: number;
  multipliers?: Multiplier[];
  dealBreakers?: DealBreakerInfo;
  tier?: 'P0_SNIPER' | 'P1_TARGETED' | 'P2_VOLUME' | 'DESCARTE';
  actionProtocol?: ActionProtocol;
  conversionProbability?: ConversionProbability;
  salaryFitBadge?: string;
  scoreBreakdown?: {
    baseScore: number;
    finalScore: number;
    insightPhrase: string;
  };
}

// === ATUALIZAÇÃO CV PARA V2.0 ===
export interface CVExperience {
  company: string;
  role: string;
  period: string;
  achievements: string[];
}

export interface CVEducation {
  institution: string;
  degree: string;
  year: string;
}

export interface CVData {
  fullName: string;
  contactInfo: string;
  summary: string;
  atsKeywords?: string[]; // Novo: Tags para header
  hardSkills?: string[]; // Novo: Separação
  softSkills?: string[]; // Novo: Separação
  skills: string[]; // Mantido para fallback
  experiences: CVExperience[];
  education: CVEducation[];
  languages: string;
}
// ==============================================

// Enums para Funil de Conversão
export type ApplicationStatus = 
  | 'ENVIADA' 
  | 'VISUALIZADA' 
  | 'CONTATO' 
  | 'ENTREVISTA_AGENDADA' 
  | 'ENTREVISTA_REALIZADA' 
  | 'PROXIMA_FASE' 
  | 'OFERTA' 
  | 'ACEITA' 
  | 'REJEITADA' 
  | 'SEM_RETORNO' 
  | 'DESISTI';

export type ApplicationChannel = 
  | 'APPLY_ONLY' 
  | 'APPLY_OUTREACH' 
  | 'INDICACAO' 
  | 'INBOUND';

export type ApplicationPlatform = 
  | 'LINKEDIN' 
  | 'GUPY' 
  | 'INDEED' 
  | 'CATHO' 
  | 'SITE_EMPRESA' 
  | 'EMAIL' 
  | 'OUTRO';

export interface StatusHistoryEntry {
  status: ApplicationStatus;
  timestamp: number;
  auto?: boolean;
}

export interface HistoryItem extends AnalysisResult {
  id: string;
  timestamp: number;
  applied?: boolean;
  clientId?: string;
  
  // Novos campos de Funil v2.0
  status?: ApplicationStatus;
  statusHistory?: StatusHistoryEntry[];
  applicationChannel?: ApplicationChannel;
  applicationPlatform?: ApplicationPlatform;
  calculatedProbability?: number; // Armazena a prob. calculada
  lastUpdated?: number;

  // Novos campos para Alertas Inteligentes
  outreachResponse?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'NONE';
  outreachDate?: number;
  interviewDate?: number;
  interviewImpression?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  dismissedAlerts?: Record<string, number>; // key: alertType, value: timestamp de dismiss
}

export type AnalysisInputType = 'text' | 'image' | 'url';

export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
  result: AnalysisResult | null;
}

export interface PendingFile {
  name: string;
  data: string;
  type: string;
  size: number;
}

export interface SystemSettings {
  geminiBaseRate: number;
  infrastructureMonthly: number;
  targetProfitMargin: number;
  supportBufferRate: number;
}

export interface GlobalStats {
  totalUsers: number;
  totalHunters: number;
  totalClients: number;
  totalAudits: number;
  totalMentorships: number;
}

export interface MentorshipRelation {
  id: string;
  mentorId: string;
  clientId: string;
  clientName: string;
  status: 'ACTIVE' | 'PENDING';
  createdAt: number;
}

export interface PricingAdvisory {
  cogsPerUser: number;
  monthly: { margin20: number; margin50: number; margin80: number; };
  annual: { margin20: number; margin50: number; margin80: number; };
}

export interface TelemetryData {
  resumeCount: { active: number, inactive: number };
  profilesGenerated: number;
  cloudCostHourly: { hour: string, cost: number }[];
  geminiUsage: { tokens: number, cost: number };
  accessCount: number;
  agentCoherence: number;
  botErrorRate: number;
  codeUpdates: number;
  apiSuccessRate: number;
  ttvDays: number;
  gmv: number;
  nrr: number;
  adoptionRate: number;
  ltv: number;
  cacRatio: number;
  ebitdaImpact: number;
  pricing: PricingAdvisory;
  daily: {
    errorRate: number;
    latencyP95: number;
    dau: number;
  };
  weekly: {
    featureAdoption: number;
    stickiness: number;
    mttr: number; 
  };
  monthly: {
    churnRate: number;
    ltvCacRatio: number;
    nps: number;
  };
}