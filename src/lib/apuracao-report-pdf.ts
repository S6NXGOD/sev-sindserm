import type { Apuracao, ReportData } from "@/lib/reports";

/** Baixa uma imagem e converte para data URL (para embutir no PDF). */
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

// Paleta SINDSERM.
const RED: [number, number, number] = [193, 39, 45];
const RED_SOFT: [number, number, number] = [252, 232, 233];
const GREEN: [number, number, number] = [22, 122, 76];
const SLATE: [number, number, number] = [100, 116, 139];

export type ApuracaoPdfHeader = {
  logoSindserm: string;
  logoPleito: string | null;
  /** Título institucional do pleito. */
  tituloPleito: string;
  /** Subtítulo do relatório (ex.: "Relatório por Zona"). */
  subtitulo: string;
  /** Descrição do filtro/critério (ex.: "Zona: LESTE"). */
  filtro: string;
  geradoEm: string;
};

// Máximo de linhas do ranking impressas por local (evita PDF gigante).
const RANKING_PDF_CAP = 15;

/**
 * PDF CONSOLIDADO de apuração — respeita o CRITÉRIO escolhido na tela de
 * Relatórios (geral / órgão / zona / local / encerradas). Cabeçalho oficial com
 * a logo do SINDSERM, resumo do pleito (contadores + top órgãos/zonas) e, por
 * local, os eleitos e o ranking dos mais votados. Gera 100% no cliente (jsPDF).
 */
export async function downloadApuracaoReportPdf(
  data: ReportData,
  header: ApuracaoPdfHeader,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 44;
  const bottom = pageHeight - 44;
  const contentW = pageWidth - marginX * 2;

  const [logoSind, logoPleito] = await Promise.all([
    fetchPngDataUrl(header.logoSindserm),
    header.logoPleito ? fetchPngDataUrl(header.logoPleito) : null,
  ]);

  const desenharTopo = () => {
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(0, 0, pageWidth, 92, "F");
    if (logoSind) {
      try {
        const props = doc.getImageProperties(logoSind);
        const maxH = 52;
        const maxW = 120;
        const scale = Math.min(maxW / props.width, maxH / props.height);
        const w = props.width * scale;
        const h = props.height * scale;
        const ly = 20 + (maxH - h) / 2;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(marginX - 6, ly - 6, w + 12, h + 12, 6, 6, "F");
        doc.addImage(logoSind, marginX, ly, w, h);
      } catch {
        /* logo inválida (ex.: SVG): ignora */
      }
    }
    // Logo do pleito no canto direito (menor), quando existir.
    if (logoPleito) {
      try {
        const props = doc.getImageProperties(logoPleito);
        const maxH = 48;
        const scale = Math.min(48 / props.width, maxH / props.height);
        const w = props.width * scale;
        const h = props.height * scale;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pageWidth - marginX - w - 6, 20, w + 12, h + 12, 6, 6, "F");
        doc.addImage(logoPleito, pageWidth - marginX - w, 26, w, h);
      } catch {
        /* ignora */
      }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SEV SINDSERM", pageWidth / 2, 40, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(header.subtitulo, pageWidth / 2, 58, { align: "center" });
    doc.setFontSize(8.5);
    doc.text(`Gerado em ${header.geradoEm}`, pageWidth / 2, 74, {
      align: "center",
    });
    doc.setTextColor(20);
  };

  desenharTopo();

  let y = 112;

  // Identificação do pleito + critério.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(
    doc.splitTextToSize(header.tituloPleito, contentW) as string[],
    marginX,
    y,
  );
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`Critério: ${header.filtro}`, marginX, y);
  doc.setTextColor(20);
  y += 16;

  // Resumo (contadores).
  const s = data.summary;
  const resumo = [
    `${s.totalLocais} local(is)`,
    `${s.totalVotos} voto(s)`,
    `${s.encerradas} encerrada(s)`,
    `${s.abertas} em andamento`,
    `${s.naoIniciadas} agendada(s)`,
    `${s.naoDefinidas} sem agenda`,
  ].join("   ·   ");
  doc.setFillColor(RED_SOFT[0], RED_SOFT[1], RED_SOFT[2]);
  doc.roundedRect(marginX, y - 12, contentW, 24, 4, 4, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(RED[0], RED[1], RED[2]);
  doc.text(resumo, marginX + 10, y + 3);
  doc.setTextColor(20);
  y += 26;

  const ensureSpace = (need: number) => {
    if (y + need > bottom) {
      doc.addPage();
      y = 48;
    }
  };

  // Top órgãos e zonas (só quando há mais de um).
  if (s.porOrgao.length > 1) {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Votos por órgão", marginX, y);
    y += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    for (const o of s.porOrgao.slice(0, 8)) {
      ensureSpace(12);
      const nome = (doc.splitTextToSize(o.orgao, contentW - 120) as string[])[0];
      doc.text(nome, marginX + 6, y);
      doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
      doc.text(`${o.locais} local(is) · ${o.votos} voto(s)`, pageWidth - marginX, y, {
        align: "right",
      });
      doc.setTextColor(20);
      y += 12;
    }
    y += 6;
  }

  // Divisor.
  ensureSpace(20);
  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Apuração por local (${data.apuracoes.length})`, marginX, y);
  y += 16;

  const bloco = (a: Apuracao) => {
    ensureSpace(70);
    // Cabeçalho do local (barra vermelha suave).
    doc.setFillColor(RED_SOFT[0], RED_SOFT[1], RED_SOFT[2]);
    doc.roundedRect(marginX, y - 12, contentW, 32, 4, 4, "F");
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(
      (doc.splitTextToSize(a.nome, contentW - 16) as string[])[0],
      marginX + 10,
      y + 1,
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(
      `${a.orgao} · Zona ${a.zona} · Janela: ${a.inicioDisplay} até ${a.fimDisplay}`,
      marginX + 10,
      y + 13,
    );
    doc.setTextColor(20);
    y += 34;

    // Linha de contadores.
    doc.setFontSize(8.5);
    doc.setTextColor(70);
    doc.text(
      `${a.totalCandidatos} candidato(s) · ${a.vagas} vaga(s) · ${a.totalVotos} voto(s)`,
      marginX + 6,
      y,
    );
    doc.setTextColor(20);
    y += 14;

    // Eleitos.
    if (a.eleitos.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
      const rotulo = a.status === "closed" ? "Eleito(s): " : "Parcial: ";
      const texto = rotulo + a.eleitos.join(", ");
      const linhas = doc.splitTextToSize(texto, contentW - 12) as string[];
      for (const ln of linhas) {
        ensureSpace(11);
        doc.text(ln, marginX + 6, y);
        y += 11;
      }
      doc.setTextColor(20);
      doc.setFont("helvetica", "normal");
    } else {
      doc.setFontSize(8.5);
      doc.setTextColor(120);
      doc.text("Sem votos / sem eleitos.", marginX + 6, y);
      doc.setTextColor(20);
      y += 11;
    }

    // Não assumiram a vaga (suplente promovido).
    if (a.renunciantes.length > 0) {
      doc.setFontSize(7.5);
      doc.setTextColor(120);
      const texto =
        "Não assumiram (suplente promovido): " +
        a.renunciantes
          .map((r) => `${r.nome}${r.motivo ? ` (${r.motivo})` : ""}`)
          .join(", ");
      for (const ln of doc.splitTextToSize(texto, contentW - 12) as string[]) {
        ensureSpace(10);
        doc.text(ln, marginX + 6, y);
        y += 10;
      }
      doc.setTextColor(20);
    }

    // Ranking (top N).
    const rank = a.ranking.slice(0, RANKING_PDF_CAP);
    if (rank.length > 0) {
      y += 3;
      doc.setFontSize(8);
      rank.forEach((c, i) => {
        ensureSpace(11);
        doc.setTextColor(c.eleito ? GREEN[0] : 40, c.eleito ? GREEN[1] : 40, c.eleito ? GREEN[2] : 40);
        doc.setFont("helvetica", c.eleito ? "bold" : "normal");
        const nome = `${i + 1}. ${c.nome}${c.eleito ? " (eleito)" : ""}`;
        doc.text(
          (doc.splitTextToSize(nome, contentW - 90) as string[])[0],
          marginX + 10,
          y,
        );
        doc.setTextColor(90);
        doc.setFont("helvetica", "normal");
        doc.text(`${c.votos} (${c.pct}%)`, pageWidth - marginX - 6, y, {
          align: "right",
        });
        doc.setTextColor(20);
        y += 11;
      });
      const restante = a.votadosCount - rank.length;
      if (restante > 0) {
        ensureSpace(11);
        doc.setFontSize(7.5);
        doc.setTextColor(140);
        doc.text(
          `+${restante} candidato(s) com votos não listados neste PDF.`,
          marginX + 10,
          y,
        );
        doc.setTextColor(20);
        y += 11;
      }
    }
    y += 10;
  };

  for (const a of data.apuracoes) bloco(a);

  // Rodapé com paginação (em todas as páginas).
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(150);
    doc.text(
      `SEV SINDSERM · Documento gerado automaticamente · Página ${p}/${total}`,
      pageWidth / 2,
      pageHeight - 24,
      { align: "center" },
    );
    doc.setTextColor(20);
  }

  doc.save(`relatorio-apuracao-${new Date().toISOString().slice(0, 10)}.pdf`);
}
