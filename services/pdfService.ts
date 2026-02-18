import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import { CVData } from '../types';

// Configurações de Design (A4: 595.28 x 841.89 pt)
// 1mm ~ 2.83pt. 25mm ~ 70.8pt.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_TOP = 70;    
const MARGIN_BOTTOM = 70; 
const MARGIN_SIDE = 50;   

const COLORS = {
  PRIMARY: rgb(0.1, 0.1, 0.1),     // Preto suave (menos cansativo que 0,0,0)
  SECONDARY: rgb(0.35, 0.35, 0.35), // Cinza escuro
  ACCENT: rgb(0.4, 0.4, 0.4),      // Datas
  LIGHT_LINE: rgb(0.85, 0.85, 0.85), // Linhas sutis
};

// Utilitário para quebra de texto
function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  if (!text) return [""];
  const words = text.split(' ');
  let lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = font.widthOfTextAtSize(currentLine + " " + word, size);
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

export async function generateCvPdf(data: CVData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  // --- Helpers de Layout ---

  const checkPageBreak = (neededSpace: number) => {
    if (y - neededSpace < MARGIN_BOTTOM) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
  };

  const drawCenteredText = (text: string, font: PDFFont, size: number, color = COLORS.PRIMARY) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    const x = (PAGE_WIDTH - textWidth) / 2;
    page.drawText(text, { x, y, size, font, color });
    y -= size * 1.5; 
  };

  const drawSectionTitle = (title: string) => {
    checkPageBreak(35);
    y -= 15; 
    const titleSize = 11;
    page.drawText(title.toUpperCase(), { 
      x: MARGIN_SIDE, 
      y, 
      size: titleSize, 
      font: fontBold, 
      color: COLORS.PRIMARY 
    });
    
    y -= 6;
    page.drawLine({
      start: { x: MARGIN_SIDE, y },
      end: { x: PAGE_WIDTH - MARGIN_SIDE, y },
      thickness: 0.75,
      color: COLORS.LIGHT_LINE,
    });
    y -= 18; // Espaço confortável após título
  };

  const drawBulletPoint = (text: string) => {
    const bulletIndent = 12; // Posição do •
    const textIndent = 28;   // Posição do texto (Hanging Indent)
    const contentWidth = PAGE_WIDTH - (MARGIN_SIDE + textIndent) - MARGIN_SIDE; // Largura útil
    const fontSize = 10;
    const lineHeight = fontSize * 1.4; // Leading mais confortável (140%)

    const lines = wrapText(text, contentWidth, fontRegular, fontSize);
    checkPageBreak(lines.length * lineHeight + 6); // +6 para margem inferior do bullet

    // Desenha o "•" alinhado com a primeira linha
    // O caractere bullet na Helvetica pode precisar de ajuste fino vertical
    page.drawText("•", { 
      x: MARGIN_SIDE + bulletIndent, 
      y, 
      size: 14, 
      font: fontRegular, 
      color: COLORS.SECONDARY 
    });

    // Desenha o texto
    for (const line of lines) {
      page.drawText(line, { 
        x: MARGIN_SIDE + textIndent, 
        y, 
        size: fontSize, 
        font: fontRegular, 
        color: COLORS.PRIMARY 
      });
      y -= lineHeight;
    }
    y -= 6; // Espaço extra entre achievements para não ficar bloco de texto
  };

  // === 1. CABEÇALHO ===
  
  // Nome
  drawCenteredText((data.fullName || "Candidato").toUpperCase(), fontBold, 22, COLORS.PRIMARY);
  y -= 4; 

  // Contato
  const contactText = data.contactInfo || "";
  if (fontRegular.widthOfTextAtSize(contactText, 9) > (PAGE_WIDTH - MARGIN_SIDE * 2)) {
      const lines = wrapText(contactText, PAGE_WIDTH - MARGIN_SIDE*2, fontRegular, 9);
      for(const l of lines) drawCenteredText(l, fontRegular, 9, COLORS.SECONDARY);
  } else {
      drawCenteredText(contactText, fontRegular, 9, COLORS.SECONDARY);
  }
  
  y -= 10; 

  // ATS KEYWORDS (V2.0 FEATURE)
  if (data.atsKeywords && data.atsKeywords.length > 0) {
    const kwText = "CORE COMPETENCIES: " + data.atsKeywords.join("  •  ");
    // Verifica se cabe
    if (fontBold.widthOfTextAtSize(kwText, 8) < (PAGE_WIDTH - MARGIN_SIDE * 2)) {
      drawCenteredText(kwText.toUpperCase(), fontBold, 8, COLORS.SECONDARY);
      y -= 10;
    }
  }

  // === 2. RESUMO EXECUTIVO ===
  if (data.summary) {
    drawSectionTitle("Resumo Executivo");
    const summaryLines = wrapText(data.summary, PAGE_WIDTH - (MARGIN_SIDE * 2), fontRegular, 10);
    checkPageBreak(summaryLines.length * 14);
    
    for (const line of summaryLines) {
      page.drawText(line, { x: MARGIN_SIDE, y, size: 10, font: fontRegular, color: COLORS.PRIMARY });
      y -= 14; // Leading padrão para parágrafos
    }
    y -= 10;
  }

  // === 3. SKILLS ESTRATÉGICAS (V2.0 SPLIT) ===
  const hasHardSoft = (data.hardSkills?.length ?? 0) > 0 || (data.softSkills?.length ?? 0) > 0;
  
  if (hasHardSoft) {
    drawSectionTitle("Competências & Skills");
    
    // Hard Skills
    if (data.hardSkills && data.hardSkills.length > 0) {
       const label = "Hard Skills: ";
       const content = data.hardSkills.join(" | ");
       const fullText = label + content;
       const lines = wrapText(fullText, PAGE_WIDTH - MARGIN_SIDE*2, fontRegular, 10);
       checkPageBreak(lines.length * 14);
       
       // Draw Bold Label inline hack logic simplistic
       // Just drawing separate for simplicity
       page.drawText("HARD SKILLS:", { x: MARGIN_SIDE, y, size: 9, font: fontBold, color: COLORS.PRIMARY });
       y -= 12;
       const hLines = wrapText(content, PAGE_WIDTH - MARGIN_SIDE*2, fontRegular, 10);
       for(const l of hLines) {
         page.drawText(l, { x: MARGIN_SIDE, y, size: 10, font: fontRegular, color: COLORS.SECONDARY });
         y -= 14;
       }
       y -= 8;
    }

    // Soft Skills
    if (data.softSkills && data.softSkills.length > 0) {
       checkPageBreak(40);
       page.drawText("SOFT SKILLS:", { x: MARGIN_SIDE, y, size: 9, font: fontBold, color: COLORS.PRIMARY });
       y -= 12;
       const content = data.softSkills.join(" | ");
       const sLines = wrapText(content, PAGE_WIDTH - MARGIN_SIDE*2, fontRegular, 10);
       for(const l of sLines) {
         page.drawText(l, { x: MARGIN_SIDE, y, size: 10, font: fontRegular, color: COLORS.SECONDARY });
         y -= 14;
       }
       y -= 8;
    }
    y -= 10;

  } else if (data.skills && data.skills.length > 0) {
    // FALLBACK V1.0
    drawSectionTitle("Competências & Skills");
    const skillsText = data.skills.join("   |   ");
    const skillLines = wrapText(skillsText, PAGE_WIDTH - (MARGIN_SIDE * 2), fontRegular, 10);
    checkPageBreak(skillLines.length * 15);

    for (const line of skillLines) {
      page.drawText(line, { x: MARGIN_SIDE, y, size: 10, font: fontRegular, color: COLORS.SECONDARY });
      y -= 15;
    }
    y -= 10;
  }

  // === 4. EXPERIÊNCIA PROFISSIONAL ===
  if (data.experiences && data.experiences.length > 0) {
    drawSectionTitle("Experiência Profissional");

    for (const exp of data.experiences) {
      checkPageBreak(60); 

      const companySize = 11;
      const dateSize = 9;
      
      // Empresa
      page.drawText(exp.company.toUpperCase(), { 
        x: MARGIN_SIDE, 
        y, 
        size: companySize, 
        font: fontBold, 
        color: COLORS.PRIMARY 
      });

      // Data (Alinhada à direita)
      if (exp.period) {
        const dateWidth = fontRegular.widthOfTextAtSize(exp.period, dateSize);
        page.drawText(exp.period, { 
          x: PAGE_WIDTH - MARGIN_SIDE - dateWidth, 
          y, 
          size: dateSize, 
          font: fontRegular, 
          color: COLORS.ACCENT 
        });
      }
      y -= 15;

      // Cargo
      page.drawText(exp.role, { 
        x: MARGIN_SIDE, 
        y, 
        size: 10, 
        font: fontItalic, 
        color: COLORS.SECONDARY 
      });
      y -= 15; // Espaço maior entre o cabeçalho do job e os bullets

      // Bullets (Achievements)
      if (exp.achievements) {
        for (const ach of exp.achievements) {
          drawBulletPoint(ach);
        }
      }
      y -= 18; // Espaço generoso entre experiências
    }
  }

  // === 5. FORMAÇÃO ACADÊMICA ===
  if (data.education && data.education.length > 0) {
    drawSectionTitle("Formação Acadêmica");
    
    for (const edu of data.education) {
      checkPageBreak(30);
      
      const eduText = `${edu.degree} - ${edu.institution}`;
      const eduLines = wrapText(eduText, PAGE_WIDTH - MARGIN_SIDE*2 - 80, fontBold, 10);

      page.drawText(eduLines[0], { x: MARGIN_SIDE, y, size: 10, font: fontBold, color: COLORS.PRIMARY });

      if (edu.year) {
        const dateWidth = fontRegular.widthOfTextAtSize(edu.year, 9);
        page.drawText(edu.year, { 
          x: PAGE_WIDTH - MARGIN_SIDE - dateWidth, 
          y, 
          size: 9, 
          font: fontRegular, 
          color: COLORS.ACCENT 
        });
      }
      y -= 13;

      for (let i = 1; i < eduLines.length; i++) {
        page.drawText(eduLines[i], { x: MARGIN_SIDE, y, size: 10, font: fontBold, color: COLORS.PRIMARY });
        y -= 13;
      }
      y -= 10;
    }
    y -= 5;
  }

  // === 6. IDIOMAS ===
  if (data.languages) {
    drawSectionTitle("Idiomas");
    const langLines = wrapText(data.languages, PAGE_WIDTH - (MARGIN_SIDE * 2), fontRegular, 10);
    checkPageBreak(langLines.length * 14);
    for (const line of langLines) {
      page.drawText(line, { x: MARGIN_SIDE, y, size: 10, font: fontRegular, color: COLORS.PRIMARY });
      y -= 14;
    }
  }

  // === RODAPÉ ===
  const footerText = "Documento gerado e otimizado via HunterMatch PRO AI";
  page.drawText(footerText, {
    x: (PAGE_WIDTH - fontRegular.widthOfTextAtSize(footerText, 8)) / 2,
    y: 35, 
    size: 8,
    font: fontRegular,
    color: COLORS.LIGHT_LINE
  });

  return await doc.save();
}