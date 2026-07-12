import type { ResultadoLocal } from "@/lib/transparencia";

async function fetchPngDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatData(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export type PdfPleito = {
  titulo: string;
  trienio: string;
  logoSindserm: string;
  logoPleito: string | null;
};

/**
 * Gera (no cliente) o PDF público de Eleitos e Suplentes de UM local encerrado.
 * Cabeçalho oficial com as logos corretas (proporção preservada), nome do local,
 * data de encerramento e a tabela com badges de Eleito/Suplente.
 */
export async function downloadResultadoPdf(
  resultado: ResultadoLocal,
  pleito: PdfPleito,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const bottom = pageHeight - 48;

  const [sindsermData, pleitoData] = await Promise.all([
    fetchPngDataUrl(pleito.logoSindserm),
    pleito.logoPleito ? fetchPngDataUrl(pleito.logoPleito) : null,
  ]);

  const drawLogo = (
    dataUrl: string,
    side: "left" | "right",
    maxW: number,
    maxH: number,
  ) => {
    try {
      const props = doc.getImageProperties(dataUrl);
      const scale = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * scale;
      const h = props.height * scale;
      const x = side === "left" ? marginX : pageWidth - marginX - w;
      doc.addImage(dataUrl, x, 38 + (maxH - h) / 2, w, h);
    } catch {
      /* ignora imagem inválida (ex.: SVG) */
    }
  };
  if (sindsermData) drawLogo(sindsermData, "left", 140, 44);
  if (pleitoData) drawLogo(pleitoData, "right", 50, 50);

  const centerX = pageWidth / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SEV SINDSERM", centerX, 56, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Portal da Transparência · Sistema Eletrônico de Votação do SINDSERM", centerX, 70, { align: "center" });
  doc.setFontSize(9.5);
  doc.text(doc.splitTextToSize(pleito.titulo, pageWidth - marginX * 2), centerX, 84, { align: "center" });

  let y = 108;
  doc.setDrawColor(210);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(doc.splitTextToSize(resultado.nome, pageWidth - marginX * 2), marginX, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${resultado.orgao} · Zona ${resultado.zona}`, marginX, y);
  y += 14;
  // Local sem janela agendada não tem data de encerramento para imprimir.
  const encerramento = resultado.dataFim
    ? `Encerrada em ${formatData(resultado.dataFim)}`
    : "Votação ainda não agendada";
  doc.text(
    `${encerramento} · ${resultado.vagas} vaga(s) · ${resultado.totalVotantes} votante(s) · ${resultado.totalCandidatos} candidato(s)`,
    marginX,
    y,
  );
  doc.setTextColor(20);
  y += 22;

  const ensureSpace = (need: number) => {
    if (y + need > bottom) {
      doc.addPage();
      y = 56;
    }
  };

  const secao = (
    titulo: string,
    itens: { nome: string; votos: number }[],
    cor: [number, number, number],
  ) => {
    ensureSpace(30);
    doc.setFillColor(cor[0], cor[1], cor[2]);
    doc.roundedRect(marginX, y - 12, pageWidth - marginX * 2, 22, 4, 4, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${titulo} (${itens.length})`, marginX + 10, y + 3);
    doc.setTextColor(20);
    y += 26;

    if (itens.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text("Nenhum.", marginX + 4, y);
      doc.setTextColor(20);
      y += 18;
      return;
    }
    doc.setFontSize(10.5);
    itens.forEach((c, i) => {
      ensureSpace(18);
      doc.setFont("helvetica", "normal");
      doc.text(`${i + 1}. ${c.nome}`, marginX + 4, y);
      doc.setFont("helvetica", "bold");
      doc.text(`${c.votos} voto(s)`, pageWidth - marginX - 4, y, { align: "right" });
      y += 16;
    });
    y += 8;
  };

  secao("ELEITOS (TITULARES)", resultado.eleitos, [16, 122, 76]);
  secao("SUPLENTES", resultado.suplentes, [100, 116, 139]);

  if (resultado.semVotos > 0) {
    ensureSpace(18);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(120);
    doc.text(`+ ${resultado.semVotos} candidato(s) sem votos.`, marginX + 4, y);
    doc.setTextColor(20);
  }

  doc.save(
    `eleitos-${resultado.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}.pdf`,
  );
}
