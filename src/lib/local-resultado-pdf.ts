import type { Apuracao } from "@/lib/reports";

// PDF do RESULTADO DE UM LOCAL — oficial, limpo e calmo (faixa institucional só
// no topo; corpo branco). Gera no cliente (jsPDF). Reaproveita o visual da
// Lista de Eleitos (eleitos-pdf.ts).

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

const RED: [number, number, number] = [193, 39, 45];
const GREEN: [number, number, number] = [22, 122, 76];
const SLATE: [number, number, number] = [100, 116, 139];
const INK: [number, number, number] = [30, 41, 59];
const GROUP_BG: [number, number, number] = [241, 245, 249];

export type LocalPdfHeader = {
  logoSindserm: string;
  logoPleito: string | null;
  tituloPleito: string;
  geradoEm: string;
};

/** Situação legível de um candidato no ranking (sem cor "radioativa"). */
function situacaoLabel(c: Apuracao["ranking"][number]): string {
  if (c.renunciou) return "Não assumiu";
  if (c.preservado) return "Eleito (mantido)";
  if (c.eleito) return "Eleito";
  return "Suplente";
}

export async function downloadLocalResultadoPdf(a: Apuracao, header: LocalPdfHeader) {
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

  const topo = () => {
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(0, 0, pageWidth, 88, "F");
    if (logoSind) {
      try {
        const p = doc.getImageProperties(logoSind);
        const scale = Math.min(116 / p.width, 48 / p.height);
        const w = p.width * scale;
        const h = p.height * scale;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(marginX - 6, 14, w + 12, h + 12, 6, 6, "F");
        doc.addImage(logoSind, marginX, 20, w, h);
      } catch {
        /* ignora */
      }
    }
    if (logoPleito) {
      try {
        const p = doc.getImageProperties(logoPleito);
        const scale = Math.min(46 / p.width, 46 / p.height);
        const w = p.width * scale;
        const h = p.height * scale;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pageWidth - marginX - w - 6, 20, w + 12, h + 12, 6, 6, "F");
        doc.addImage(logoPleito, pageWidth - marginX - w, 26, w, h);
      } catch {
        /* ignora */
      }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("SEV SINDSERM", pageWidth / 2, 38, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Resultado do Local de Votação", pageWidth / 2, 56, {
      align: "center",
    });
    doc.setFontSize(8.5);
    doc.text(`Gerado em ${header.geradoEm}`, pageWidth / 2, 72, {
      align: "center",
    });
    doc.setTextColor(INK[0], INK[1], INK[2]);
  };

  topo();
  let y = 108;

  // Título do pleito.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(
    (doc.splitTextToSize(header.tituloPleito, contentW) as string[])[0],
    marginX,
    y,
  );
  y += 20;

  // Nome do local (destaque).
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  for (const ln of doc.splitTextToSize(a.nome, contentW) as string[]) {
    doc.text(ln, marginX, y);
    y += 18;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(`${a.orgao} · Zona ${a.zona}`, marginX, y);
  y += 14;
  const metaLinha =
    `Janela: ${a.inicioDisplay} até ${a.fimDisplay} · ${a.vagas} ${a.vagas === 1 ? "vaga" : "vagas"} · ` +
    `${a.totalVotos} ${a.totalVotos === 1 ? "voto" : "votos"}` +
    (a.rodadaAtual > 1 ? ` · ${a.rodadaAtual}ª rodada (suplementar)` : "");
  doc.text(
    (doc.splitTextToSize(metaLinha, contentW) as string[]).join(" "),
    marginX,
    y,
  );
  doc.setTextColor(INK[0], INK[1], INK[2]);
  y += 20;

  // Eleitos em destaque.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(
    `Eleito(s): ${a.eleitos.length}`,
    marginX,
    y,
  );
  y += 6;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 16;

  // Tabela do ranking.
  const colNum = marginX;
  const colNome = marginX + 24;
  const colVotos = pageWidth - marginX - 90;
  const colPct = pageWidth - marginX - 6;

  const header2 = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.text("#", colNum, y);
    doc.text("Candidato / situação", colNome, y);
    doc.text("Votos", colVotos, y, { align: "right" });
    doc.text("%", colPct, y, { align: "right" });
    doc.setTextColor(INK[0], INK[1], INK[2]);
    y += 6;
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 12;
  };
  header2();

  const ensure = (need: number) => {
    if (y + need > bottom) {
      doc.addPage();
      y = 48;
      header2();
    }
  };

  doc.setFontSize(9);
  a.ranking.forEach((c, i) => {
    ensure(15);
    const eleito = (c.eleito || c.preservado) && !c.renunciou;
    if (eleito) {
      doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
      doc.circle(colNum + 3, y - 3, 1.6, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.setFontSize(8);
    doc.text(String(i + 1), colNum + 8, y);
    doc.setFontSize(9);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.setFont("helvetica", eleito ? "bold" : "normal");
    const nome = (doc.splitTextToSize(c.nome, colVotos - colNome - 70) as string[])[0];
    doc.text(nome, colNome, y);
    // Situação (cinza, à direita do nome).
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.text(situacaoLabel(c), colNome, y + 9);
    doc.setFontSize(9);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(String(c.votos), colVotos, y, { align: "right" });
    doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.text(`${c.pct}%`, colPct, y, { align: "right" });
    doc.setTextColor(INK[0], INK[1], INK[2]);
    y += 18;
  });

  if (a.ranking.length === 0) {
    doc.setFontSize(9.5);
    doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.text("Sem votos registrados.", marginX, y);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    y += 16;
  }

  // Rodapé com paginação.
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `SEV SINDSERM · Resultado do local · Página ${p}/${total}`,
      pageWidth / 2,
      pageHeight - 22,
      { align: "center" },
    );
  }

  const slug = a.nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  doc.save(`resultado-${slug || "local"}.pdf`);
}
