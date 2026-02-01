
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

// Instanciamos fora para evitar overhead de recriação
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    jobTitle: { type: Type.STRING },
    company: { type: Type.STRING },
    location: { type: Type.STRING },
    workModel: { type: Type.STRING, enum: ['Presencial', 'Híbrido', 'Remoto', 'Não especificado'] },
    matchScore: { type: Type.NUMBER },
    connections: { type: Type.STRING },
    gaps: { type: Type.STRING },
    interviewPitch: { type: Type.STRING },
    adequacySummary: { type: Type.STRING },
    requiresFluentEnglish: { type: Type.BOOLEAN }
  },
  required: ["jobTitle", "company", "location", "workModel", "matchScore", "connections", "gaps", "interviewPitch", "adequacySummary", "requiresFluentEnglish"]
};

const SYSTEM_INSTRUCTION = `Você é um Headhunter Sênior Ultra-Rápido. Sua missão é analisar vagas e comparar com o perfil do candidato com precisão cirúrgica e zero enrolação.
Métricas de Rigor:
- Se a vaga pede inglês fluente e o candidato é intermediário: matchScore máximo 50.
- Analise tecnicamente: stack, cultura e senioridade.
- Responda estritamente em JSON.`;

export async function analyzeJobContext(
  input: string, 
  type: 'text' | 'image' | 'url', 
  profileContent: string
): Promise<AnalysisResult> {
  const model = 'gemini-3-flash-preview';
  
  const contents: any[] = [];
  
  if (type === 'url') {
    contents.push({
      parts: [{ text: `PERFIL: ${profileContent}\n\nURL DA VAGA: ${input}\n\nInstrução: Use o Google Search apenas para extrair a descrição da vaga e retorne a análise JSON.` }]
    });
  } else if (type === 'image') {
    contents.push({
      parts: [
        { inlineData: { mimeType: 'image/png', data: input.split(',')[1] || input } },
        { text: `PERFIL: ${profileContent}\nAnalise o print e retorne o JSON.` }
      ]
    });
  } else {
    contents.push({
      parts: [{ text: `PERFIL: ${profileContent}\nVAGA: ${input}\nAnalise e retorne o JSON.` }]
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: ANALYSIS_SCHEMA,
        temperature: 0.1, // Menor temperatura = resposta mais rápida e estável
        topP: 0.8,
      },
    });

    const resultText = response.text;
    if (!resultText) throw new Error("Empty response");
    
    const parsed = JSON.parse(resultText) as AnalysisResult;
    if (type === 'text') parsed.rawJobDescription = input;
    
    return parsed;
  } catch (error) {
    console.error("Gemini Engine Error:", error);
    throw new Error("Erro no processamento da IA. Verifique os dados e tente novamente.");
  }
}
