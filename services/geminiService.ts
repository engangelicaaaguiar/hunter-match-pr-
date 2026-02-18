import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, CVData, TelemetryData } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

function cleanAiResponse(text: string): string {
  let clean = text.replace(/```json\n?|\n?```/g, '');
  clean = clean.replace(/[\u0000-\u001F]+/g, '');
  return clean.trim();
}

export async function analyzeJobContext(input: string, type: 'text' | 'image' | 'url', profile: string): Promise<{ result: AnalysisResult, usage?: any }> {
  const ai = getAI();
  const modelName = 'gemini-3-flash-preview';
  
  const systemInstruction = `Você é um Senior Job Hunter e Estrategista de Carreira Executiva com especialização em Product Management, Inteligência Artificial aplicada e mercados regulados. Sua missão é realizar uma AUDITORIA DE MATCH DE ALTA PRECISÃO em duas fases obrigatórias.

**FASE 1 — PARSE ESTRUTURADO (Obrigatório antes de qualquer avaliação):**
Antes de emitir qualquer opinião ou score, você DEVE extrair e normalizar os campos estruturados da vaga. Classifique setor, senioridade, função, modelo de trabalho, idiomas, domínios e ferramentas em categorias padronizadas.

**FASE 2 — SCORING DIMENSIONAL:**
Calcule o match em 7 dimensões independentes:
1. Competência Técnica de Produto (25%): Cobertura do ciclo de vida e tipo de produto.
2. Domínio de Setor e Indústria (20%): Experiência profunda vs tangencial. Floor de 65% se ambos forem regulados.
3. Senioridade e Escopo (15%): Nível exato, overqualification (bom até 2 níveis) ou stretch.
4. Idioma e Comunicação (15%): Worst-case rule. Gap de 2+ níveis em obrigatório = score baixo.
5. Modelo de Trabalho e Localização (10%): Remoto/Híbrido/Presencial.
6. Fit Salarial (8%): Comparação com sweet spot do candidato.
7. Ferramentas e Stack Técnico (7%): Cobertura de ferramentas obrigatórias.

**MULTIPLICADORES & DEAL-BREAKERS:**
- Boosts: IA (+10%), First Hire/Zero-to-One (+8%), Setor Regulado (+5%), Mesma Cidade (+5%).
- Penalties: Overqualification severa 3+ níveis (-10%), Banco de Talentos (-5%), Consultoria (-3%).
- Caps: Idioma gap severo (max 50%), Presencial outra cidade (max 35%), Domínio core ausente (max 40%).

**CLASSIFICAÇÃO EM TIER:**
- 85%+: P0 SNIPER
- 70-84%: P1 TARGETED
- 55-69%: P2 VOLUME
- <55%: DESCARTE

**REGRAS DE OURO:**
1. O score é calculado SEMPRE sobre os campos normalizados.
2. Variação máxima de 5 pontos para a mesma vaga.
3. Sempre sugerir mitigação para cada gap.
4. Imersão: Descreva o dia a dia real em segunda pessoa.
5. Valor: Estime a faixa salarial com números reais (Glassdoor/Levels).`;
  
  const userPrompt = `
=== PERFIL MESTRE DO CANDIDATO ===
${profile}

=== VAGA PARA ANÁLISE (${type.toUpperCase()}) ===
${input}

EXECUTE AS DUAS FASES OBRIGATÓRIAS (Parse -> Score Dimensional).
Retorne o JSON completo preenchendo parsedFields, dimensionScores, multipliers, dealBreakers, tier, actionProtocol, conversionProbability e scoreBreakdown.
`;

  try {
    const config: any = {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          // Campos Legados (Mantidos para compatibilidade UI)
          jobTitle: { type: Type.STRING },
          company: { type: Type.STRING },
          location: { type: Type.STRING },
          workModel: { type: Type.STRING, enum: ['Presencial', 'Híbrido', 'Remoto', 'Não especificado'] },
          matchScore: { type: Type.NUMBER },
          connections: { type: Type.STRING, description: "Lista de 3 sinergias: Fato + Métrica + Link Vaga." },
          gaps: { type: Type.STRING, description: "Gaps com severidade e mitigação sugerida." },
          jobSummary: { type: Type.STRING },
          dayToDayScenario: { type: Type.STRING, description: "3 momentos do dia em segunda pessoa." },
          salarySpecific: { type: Type.STRING },
          adequacySummary: { type: Type.STRING },
          candidateTrajectorySummary: { type: Type.STRING, description: "Personal Branding Statement." },
          salaryReputation: { type: Type.STRING },
          requiresFluentEnglish: { type: Type.BOOLEAN },
          positioningDiagnosis: {
            type: Type.OBJECT,
            properties: {
              overqualified: { type: Type.STRING },
              perfect: { type: Type.STRING },
              noise: { type: Type.STRING }
            },
            required: ['overqualified', 'perfect', 'noise']
          },
          narrativeOptimization: { type: Type.STRING },
          mindsetStrategy: { type: Type.STRING },

          // Novos Campos v2.0
          parsedFields: {
            type: Type.OBJECT,
            properties: {
              jobTitle: { type: Type.STRING },
              company: { type: Type.STRING },
              sector: { type: Type.STRING },
              seniority: { type: Type.STRING },
              coreFunction: { type: Type.STRING },
              workModel: { type: Type.STRING },
              location: { type: Type.STRING },
              salaryRange: { type: Type.STRING },
              requiredLanguages: { type: Type.ARRAY, items: { type: Type.STRING } },
              topKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              mandatoryTools: { type: Type.ARRAY, items: { type: Type.STRING } },
              dealBreakers: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          },
          dimensionScores: {
            type: Type.OBJECT,
            properties: {
              technicalCompetence: { type: Type.NUMBER },
              sectorDomain: { type: Type.NUMBER },
              seniorityFit: { type: Type.NUMBER },
              languageFit: { type: Type.NUMBER },
              locationFit: { type: Type.NUMBER },
              salaryFit: { type: Type.NUMBER },
              stackFit: { type: Type.NUMBER }
            }
          },
          rawWeightedScore: { type: Type.NUMBER },
          multipliers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['BOOST', 'PENALTY'] },
                percentage: { type: Type.NUMBER },
                reason: { type: Type.STRING }
              }
            }
          },
          dealBreakers: {
            type: Type.OBJECT,
            properties: {
              activated: { type: Type.BOOLEAN },
              capApplied: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            }
          },
          tier: { type: Type.STRING, enum: ['P0_SNIPER', 'P1_TARGETED', 'P2_VOLUME', 'DESCARTE'] },
          actionProtocol: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              checklist: { type: Type.ARRAY, items: { type: Type.STRING } },
              estimatedTime: { type: Type.STRING }
            }
          },
          conversionProbability: {
            type: Type.OBJECT,
            properties: {
              percentage: { type: Type.NUMBER },
              positiveFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
              riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          },
          salaryFitBadge: { type: Type.STRING },
          scoreBreakdown: {
            type: Type.OBJECT,
            properties: {
              baseScore: { type: Type.NUMBER },
              finalScore: { type: Type.NUMBER },
              insightPhrase: { type: Type.STRING }
            }
          }
        },
        required: ['matchScore', 'parsedFields', 'dimensionScores', 'tier', 'actionProtocol', 'salarySpecific', 'dayToDayScenario']
      }
    };

    const response = await ai.models.generateContent({
      model: modelName,
      contents: type === 'image' 
        ? { parts: [{ inlineData: { data: input.split(',')[1], mimeType: input.split(',')[0].split(':')[1].split(';')[0] } }, { text: userPrompt }] }
        : { parts: [{ text: userPrompt }] },
      config
    });
    
    const cleanText = cleanAiResponse(response.text || "");
    return { result: JSON.parse(cleanText), usage: response.usageMetadata };
  } catch (error: any) {
    throw new Error(`Falha na análise: ${error.message}`);
  }
}

export async function generateTailoredCV(result: AnalysisResult, profile: string): Promise<CVData> {
  const ai = getAI();
  
  // Extrai dados v2.0 se disponíveis
  const keywords = result.parsedFields?.topKeywords?.join(", ") || "N/A";
  const tier = result.tier || "N/A";
  
  const prompt = `
ATUE COMO UM ESCRITOR DE CURRÍCULOS EXECUTIVOS DE ELITE (TOP-TIER RESUME WRITER) ESPECIALIZADO EM ATS.
Sua tarefa é reescrever o currículo do candidato para ser PERFEITO para a vaga de "${result.jobTitle}" na empresa "${result.company}".

=== DADOS DA VAGA (TARGET) ===
Tier de Match: ${tier}
Pontos Fortes: ${result.connections}
Gaps: ${result.gaps}
Palavras-chave Críticas (ATS): ${keywords}
Resumo: ${result.jobSummary}

=== PERFIL ORIGINAL ===
${profile}

=== DIRETRIZES V2.0 (RÍGIDAS) ===
1. **Otimização ATS (NOVO)**: Injete as palavras-chave críticas no Sumário e Skills.
2. **Sumário Executivo**: Personal Branding Statement poderoso. Abra com a conquista mais impactante conectada ao desafio da vaga.
3. **Experiência**: Use método STAR. Inicie com Verbos de Ação Fortes. QUANTIFIQUE resultados. Reordene bullets pela relevância para ESTA vaga.
4. **Skills**: Divida estritamente em 'Hard Skills' (tecnicas/ferramentas da vaga) e 'Soft Skills'.
5. **Idioma**: PT-BR (salvo se vaga for internacional).

Gere APENAS o JSON final.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: { parts: [{ text: prompt }] },
    config: { 
      temperature: 0.4, 
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fullName: { type: Type.STRING },
          contactInfo: { type: Type.STRING },
          summary: { type: Type.STRING },
          atsKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "As 5 principais keywords usadas" },
          hardSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          softSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          skills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista unificada para fallback" },
          languages: { type: Type.STRING },
          experiences: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                company: { type: Type.STRING },
                role: { type: Type.STRING },
                period: { type: Type.STRING },
                achievements: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['company', 'role', 'period', 'achievements']
            }
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                institution: { type: Type.STRING },
                degree: { type: Type.STRING },
                year: { type: Type.STRING }
              },
              required: ['institution', 'degree', 'year']
            }
          }
        },
        required: ['fullName', 'contactInfo', 'summary', 'skills', 'hardSkills', 'softSkills', 'atsKeywords', 'experiences', 'education', 'languages']
      }
    }
  });

  const cleanText = cleanAiResponse(response.text || "");
  return JSON.parse(cleanText) as CVData;
}

export async function consolidateProfileFromFiles(filesBase64: { data: string, mimeType: string }[], currentText: string): Promise<string> {
  const ai = getAI();
  
  const systemInstruction = `Você é um Especialista em Extração de Dados Curriculares.
Consolide os currículos em um "Perfil Mestre".

**NOVO (V2.0):** Ao final, adicione uma seção 'METADADOS DO PERFIL' contendo:
- Senioridade estimada
- Função atual
- Anos xp total e produto
- Idiomas (nível real)
- Setores (profundidade)
- Domínios fortes
- Ferramentas
- Diferenciais e Limitadores.

Esses metadados alimentarão o motor de auditoria. Seja rigoroso.`;

  const userPrompt = `
=== PERFIL BASE ===
${currentText}

=== INSTRUÇÃO ===
Analise os documentos. Gere o texto consolidado + METADADOS ESTRUTURADOS ao final.
`;

  const parts: any[] = filesBase64.map(file => ({
    inlineData: { data: file.data, mimeType: file.mimeType }
  }));
  parts.push({ text: userPrompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts },
    config: { systemInstruction, temperature: 0.3 }
  });

  return response.text || "";
}

export async function analyzeDashboardMetrics(data: TelemetryData): Promise<string> {
  const ai = getAI();
  const prompt = `Analise a telemetria do HunterMatch PRO: ${JSON.stringify(data)}`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: prompt }] }],
    config: { systemInstruction: "Você é um analista de governança SaaS." }
  });
  return response.text || "";
}