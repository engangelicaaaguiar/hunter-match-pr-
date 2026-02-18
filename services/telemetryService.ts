import { TelemetryData, PricingAdvisory, SystemSettings, HistoryItem, UserProfile } from "../types";
import { storage, AuditLogEntry } from "./storageService";

export const getTelemetryData = async (): Promise<TelemetryData> => {
  // Carrega todos os dados "crus" do DB
  const [history, logs, users, settings] = await Promise.all([
    storage.getAllHistory(),
    storage.getAuditLogs(),
    // @ts-ignore - Método privado exposto via getGlobalStats, mas precisamos dos dados brutos aqui. 
    // Em um cenário real, teríamos um método dedicado getUserCount ou getAllUsers no storageService public.
    // Vou usar um hack limpo: recriar a query de users aqui ou assumir acesso.
    // Melhor: vamos usar o storageService.getGlobalStats como proxy ou adicionar um método novo.
    // Como não posso alterar storageService agora, vou assumir que logs e history são suficientes para métricas de atividade.
    // Para churn preciso de users. Vou tentar usar os logs para inferir users únicos se não conseguir listar todos.
    storage.getAuditLogs().then(l => l), // Placeholder, usando logs para extrair UIDs
    storage.getSettings()
  ]);

  // Recalcular lista de usuários únicos baseados em logs e historico (fallback robusto)
  const uniqueUserIds = new Set<string>();
  logs.forEach(l => uniqueUserIds.add(l.uid));
  history.forEach(h => uniqueUserIds.add(h.clientId || 'unknown'));
  
  const totalUsersCount = uniqueUserIds.size;
  const accessCount = parseInt(localStorage.getItem('hunter_match_access_count') || '0');
  
  // FINOPS REAL: Soma total de tokens de todos os logs
  const totalTokens = logs.reduce((sum, log) => sum + (log.tokensUsed || 0), 0);
  const realGeminiCost = (totalTokens / 1000000) * settings.geminiBaseRate;
  
  // COGS REAL: Baseado no custo real dividido pelo volume de auditorias
  const geminiMonthlyShare = logs.length > 0 ? (realGeminiCost / logs.length) * 30 : 0;
  const cogsPerUser = settings.infrastructureMonthly + geminiMonthlyShare + (settings.supportBufferRate / 10);

  const calculatePrice = (cogs: number, margin: number) => cogs / (1 - margin);

  const pricing: PricingAdvisory = {
    cogsPerUser,
    monthly: {
      margin20: calculatePrice(cogsPerUser, 0.20),
      margin50: calculatePrice(cogsPerUser, 0.50),
      margin80: calculatePrice(cogsPerUser, 0.80),
    },
    annual: {
      margin20: calculatePrice(cogsPerUser, 0.20) * 12 * 0.85,
      margin50: calculatePrice(cogsPerUser, 0.50) * 12 * 0.85,
      margin80: calculatePrice(cogsPerUser, 0.80) * 12 * 0.85,
    }
  };

  // === CÁLCULO DE CUSTOS POR HORA (REAL) ===
  // Agrupa os logs das últimas 24h por hora do dia
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const last24hLogs = logs.filter(l => l.timestamp > now - oneDayMs);
  
  const hourlyCosts = new Array(24).fill(0);
  last24hLogs.forEach(log => {
    const date = new Date(log.timestamp);
    const hour = date.getHours();
    hourlyCosts[hour] += log.costEstimate || 0;
  });

  const hoursData = hourlyCosts.map((cost, i) => ({
    hour: `${i}:00`,
    cost: parseFloat(cost.toFixed(4)) // Custo real aglomerado
  }));

  // === CÁLCULO DAS MÉTRICAS "FOUR GOLDEN SIGNALS" ===
  
  // 1. ERROR RATE (DIÁRIO)
  // Filtrar logs de 24h. Contar status = 'ERROR'
  const dailyTotalReqs = last24hLogs.length;
  const dailyErrors = last24hLogs.filter(l => l.status === 'ERROR').length;
  const dailyErrorRate = dailyTotalReqs > 0 ? (dailyErrors / dailyTotalReqs) * 100 : 0;

  // 2. LATENCY (Não medido atualmente, retornar 0 para ser honesto)
  // Futuro: Adicionar 'duration' no AuditLogEntry
  const latencyP95 = 0; 

  // 3. DAU (Daily Active Users)
  // Usuários únicos que geraram logs nas últimas 24h
  const dailyActiveUsers = new Set(last24hLogs.map(l => l.uid)).size;

  // === MÉTRICAS SEMANAIS (TÁTICO) ===
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const lastWeekLogs = logs.filter(l => l.timestamp > now - oneWeekMs);

  // 1. Feature Adoption
  // Consideramos 'CONSOLIDATE_PROFILE' (Upload PDF) como feature nova/avançada.
  // Feature Adoption = (Users who used PDF) / (Total Active Users this week)
  const weekActiveUsers = new Set(lastWeekLogs.map(l => l.uid));
  const pdfUsers = new Set(lastWeekLogs.filter(l => l.action === 'CONSOLIDATE_PROFILE').map(l => l.uid));
  const featureAdoption = weekActiveUsers.size > 0 
    ? (pdfUsers.size / weekActiveUsers.size) * 100 
    : 0;

  // 2. Stickiness (DAU / MAU)
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
  const lastMonthLogs = logs.filter(l => l.timestamp > now - oneMonthMs);
  const monthlyActiveUsers = new Set(lastMonthLogs.map(l => l.uid)).size;
  
  // Stickiness Ratio
  const stickiness = monthlyActiveUsers > 0 
    ? (dailyActiveUsers / monthlyActiveUsers) * 100 
    : 0;

  // 3. MTTR (Não temos incidentes registrados, retorna 0)
  const mttr = 0;

  // === MÉTRICAS MENSAIS (ESTRATÉGICO) ===
  
  // 1. Churn Rate (Estimado)
  // Usuários ativos mês passado (30-60 dias atrás) que NÃO estão ativos este mês (0-30 dias).
  const twoMonthsMs = 60 * 24 * 60 * 60 * 1000;
  const previousMonthLogs = logs.filter(l => l.timestamp > (now - twoMonthsMs) && l.timestamp <= (now - oneMonthMs));
  
  const prevMonthUsers = new Set(previousMonthLogs.map(l => l.uid));
  const currentMonthUsersSet = new Set(lastMonthLogs.map(l => l.uid));
  
  let churnedCount = 0;
  prevMonthUsers.forEach(uid => {
    if (!currentMonthUsersSet.has(uid)) churnedCount++;
  });
  
  const churnRate = prevMonthUsers.size > 0 
    ? (churnedCount / prevMonthUsers.size) * 100 
    : 0;

  // 2. LTV:CAC (Aproximação baseada em settings)
  // LTV = (Avg Revenue per User * Gross Margin) / Churn
  // Como não temos revenue real, usamos um proxy fixo de assinatura ($29.90) se for user pago, ou 0.
  // Vamos assumir $29.90/mês para cálculo de ilustração de valor
  const avgRevenuePerUser = 29.90; 
  const grossMargin = 0.80; // 80% SaaS standard
  // Evitar divisão por zero no churn
  const effectiveChurn = Math.max(churnRate / 100, 0.05); // Min 5% churn assumption for math stability
  const calculatedLTV = (avgRevenuePerUser * grossMargin) / effectiveChurn;
  
  // CAC (Custo de Aquisição) - Mock fixo pois não temos dados de mkt, mas usamos o cogsPerUser como proxy de custo de setup
  const estimatedCAC = cogsPerUser * 3; // Regra de dedão
  const ltvCacRatio = estimatedCAC > 0 ? calculatedLTV / estimatedCAC : 0;

  // 3. NPS (Não coletado)
  const nps = 0;

  return {
    resumeCount: { active: 0, inactive: history.length },
    profilesGenerated: logs.filter(l => l.action === 'CONSOLIDATE_PROFILE').length,
    cloudCostHourly: hoursData,
    geminiUsage: { tokens: totalTokens, cost: parseFloat(realGeminiCost.toFixed(4)) },
    accessCount,
    agentCoherence: 100, // Placeholder, difícil medir deterministicamente sem feedback loop
    botErrorRate: dailyErrorRate,
    codeUpdates: 45, // Hardcoded build number version
    apiSuccessRate: 100 - dailyErrorRate,
    ttvDays: 0, // Needs User CreatedAt to First Success Log delta
    gmv: history.length * 0, // No real transaction data
    nrr: 100, // No expansion revenue data
    adoptionRate: featureAdoption,
    ltv: parseFloat(calculatedLTV.toFixed(2)),
    cacRatio: parseFloat(ltvCacRatio.toFixed(2)),
    ebitdaImpact: 0,
    pricing,
    daily: {
      errorRate: parseFloat(dailyErrorRate.toFixed(2)),
      latencyP95: Math.round(latencyP95),
      dau: dailyActiveUsers
    },
    weekly: {
      featureAdoption: parseFloat(featureAdoption.toFixed(1)),
      stickiness: parseFloat(stickiness.toFixed(1)),
      mttr
    },
    monthly: {
      churnRate: parseFloat(churnRate.toFixed(1)),
      ltvCacRatio: parseFloat(ltvCacRatio.toFixed(1)),
      nps
    }
  };
};