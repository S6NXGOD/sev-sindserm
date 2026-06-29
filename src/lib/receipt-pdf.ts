import type { VoteReceipt } from "@/lib/types";

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

/**
 * Gera e baixa o comprovante de votação em PDF (lado do cliente).
 * O jsPDF é carregado dinamicamente (só ao clicar) para não pesar a página
 * pública de votação.
 * IMPORTANTE: o comprovante NÃO contém o candidato escolhido — o voto é secreto.
 * Ele apenas atesta o comparecimento (quem votou, onde e quando) + protocolo.
 */
export async function downloadReceiptPdf(receipt: VoteReceipt) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 56;
  // Faixa do cabeçalho onde as logos são desenhadas (topo y / altura).
  const LOGO_TOP = 40;

  /**
   * Desenha a logo PRESERVANDO a proporção (sem espremer): encaixa a imagem
   * dentro de uma caixa (maxW × maxH) e centraliza na vertical da faixa. A logo
   * do SINDSERM é horizontal (banner ~3:1) — desenhá-la num quadrado a deixava
   * "espremida"; por isso a escala respeita as dimensões reais da imagem.
   */
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
      const y = LOGO_TOP + (maxH - h) / 2;
      doc.addImage(dataUrl, x, y, w, h);
    } catch {
      /* imagem inválida (ex.: SVG) ou sem metadados: segue sem ela */
    }
  };

  // CABEÇALHO — regra estrita de logos:
  //  - SINDSERM à ESQUERDA (sempre; a URL já vem com o DEFAULT_LOGO de fallback).
  //  - Pleito à DIREITA (somente se houver; sem fallback, sem imagem quebrada).
  //  - Título SEMPRE centralizado → cabeçalho simétrico mesmo sem a logo do pleito.
  // Carrega as duas em paralelo (pleito só se existir).
  const [sindsermData, pleitoData] = await Promise.all([
    fetchPngDataUrl(receipt.logoSindsermUrl),
    receipt.logoPleitoUrl ? fetchPngDataUrl(receipt.logoPleitoUrl) : null,
  ]);

  // SINDSERM: caixa horizontal (até 140×46) para o banner ~3:1.
  if (sindsermData) drawLogo(sindsermData, "left", 140, 46);
  // Pleito: caixa quadrada (até 52×52).
  if (pleitoData) drawLogo(pleitoData, "right", 52, 52);

  // Título centralizado (entre as logos) — mantém a simetria do cabeçalho.
  const centerX = pageWidth / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SEV SINDSERM", centerX, 60, { align: "center" });
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");
  doc.text("Sistema Eletrônico de Votação do SINDSERM", centerX, 76, {
    align: "center",
  });
  doc.text("Eleições Representantes de Base", centerX, 89, { align: "center" });

  let y = 104;
  doc.setDrawColor(200);
  doc.line(marginX, y, pageWidth - marginX, y);

  y += 32;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Comprovante de Votação", marginX, y);

  // Protocolo em destaque
  y += 28;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(marginX, y - 18, pageWidth - marginX * 2, 36, 6, 6, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Protocolo:", marginX + 12, y + 5);
  doc.setFont("helvetica", "bold");
  doc.text(receipt.protocolo, marginX + 80, y + 5);

  // Campos
  y += 46;
  const linha = (rotulo: string, valor: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(rotulo.toUpperCase(), marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(valor || "—", marginX, y + 16);
    y += 38;
  };

  linha("Votante", receipt.nome);
  linha("CPF", receipt.cpfMascarado);
  linha("Matrícula", receipt.matricula);
  linha("Local de Trabalho", receipt.local);
  linha("Órgão", receipt.orgao);
  linha("Zona", receipt.zona);
  linha("Data e hora do voto", receipt.dataHora);

  // Rodapé / aviso de sigilo
  y += 8;
  doc.setDrawColor(200);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 22;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(90);
  const aviso =
    "Este comprovante atesta o comparecimento e o registro do voto. O voto é " +
    "secreto: este documento NÃO contém e não permite identificar o candidato " +
    "escolhido. Tratamento de dados conforme a LGPD (Lei nº 13.709/2018).";
  doc.text(doc.splitTextToSize(aviso, pageWidth - marginX * 2), marginX, y);

  doc.save(`comprovante-votacao-${receipt.protocolo}.pdf`);
}
