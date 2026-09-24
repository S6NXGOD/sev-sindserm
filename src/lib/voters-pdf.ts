import type { jsPDF } from "jspdf";

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

const RED: [number, number, number] = [193, 39, 45];
const RED_SOFT: [number, number, number] = [252, 232, 233];
const GREEN: [number, number, number] = [22, 122, 76];
const SLATE: [number, number, number] = [100, 116, 139];
const ZEBRA: [number, number, number] = [246, 247, 249];

export type VotersPdfHeader = {
  logoSindserm: string;
  logoPleito: string | null;
  tituloPleito: string;
  /** Subtítulo do documento (ex.: "Lista de Votantes"). */
  subtitulo: string;
  /** Descrição do filtro aplicado (ex.: "Não filiados · Zona SUL"). */
  filtro: string;
  geradoEm: string;
};

export type VoterPdfRow = {
  nome: string;
  telefone: string;
  email: string;
  filiado: boolean;
  local: string;
  orgao: string;
  zona: string;
};

const COLS: { key: keyof VoterPdfRow | "filiacao"; label: string; w: number }[] = [
  { key: "nome", label: "Nome", w: 190 },
  { key: "telefone", label: "Telefone", w: 96 },
  { key: "email", label: "E-mail", w: 168 },
  { key: "filiacao", label: "Filiação", w: 62 },
  { key: "local", label: "Local", w: 150 },
  { key: "zona", label: "Zona", w: 56 },
];

/**
 * PDF da LISTA DE VOTANTES (para contato / campanha de filiação). Respeita os
 * filtros da tela. Cabeçalho institucional + tabela em paisagem (cabe telefone e
 * e-mail). Gera 100% no cliente (jsPDF). Traz rodapé de uso restrito (LGPD).
 */
export async function downloadVotersPdf(
  rows: VoterPdfRow[],
  totais: { total: number; filiados: number },
  header: VotersPdfHeader,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const bottom = pageHeight - 40;

  const [logoSind, logoPleito] = await Promise.all([
    fetchPngDataUrl(header.logoSindserm),
    header.logoPleito ? fetchPngDataUrl(header.logoPleito) : null,
  ]);

  const desenharTopo = () => {
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(0, 0, pageWidth, 84, "F");
    if (logoSind) {
      try {
        const props = doc.getImageProperties(logoSind);
        const maxH = 46;
        const scale = Math.min(110 / props.width, maxH / props.height);
        const w = props.width * scale;
        const h = props.height * scale;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(marginX - 6, 18, w + 12, h + 12, 6, 6, "F");
        doc.addImage(logoSind, marginX, 24, w, h);
      } catch {
        /* logo inválida: ignora */
      }
    }
    if (logoPleito) {
      try {
        const props = doc.getImageProperties(logoPleito);
        const maxH = 44;
        const scale = Math.min(44 / props.width, maxH / props.height);
        const w = props.width * scale;
        const h = props.height * scale;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pageWidth - marginX - w - 6, 18, w + 12, h + 12, 6, 6, "F");
        doc.addImage(logoPleito, pageWidth - marginX - w, 24, w, h);
      } catch {
        /* ignora */
      }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("SEV SINDSERM", pageWidth / 2, 36, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(header.subtitulo, pageWidth / 2, 54, { align: "center" });
    doc.setFontSize(8.5);
    doc.text(`Gerado em ${header.geradoEm}`, pageWidth / 2, 70, { align: "center" });
    doc.setTextColor(20);
  };

  desenharTopo();
  let y = 104;

  // Pleito + critério.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(header.tituloPleito, marginX, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(`Critério: ${header.filtro}`, marginX, y);
  doc.setTextColor(20);
  y += 16;

  // Resumo.
  const naoFiliados = Math.max(0, totais.total - totais.filiados);
  const resumo = `${totais.total} votante(s)   ·   ${totais.filiados} filiado(s)   ·   ${naoFiliados} não filiado(s)`;
  doc.setFillColor(RED_SOFT[0], RED_SOFT[1], RED_SOFT[2]);
  doc.roundedRect(marginX, y - 12, pageWidth - marginX * 2, 22, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(RED[0], RED[1], RED[2]);
  doc.text(resumo, marginX + 10, y + 2);
  doc.setTextColor(20);
  y += 26;

  // Cabeçalho da tabela.
  const desenharColunas = () => {
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(marginX, y - 11, pageWidth - marginX * 2, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    let x = marginX + 6;
    for (const c of COLS) {
      doc.text(c.label, x, y + 1);
      x += c.w;
    }
    doc.setTextColor(20);
    y += 16;
  };
  desenharColunas();

  // Trunca um texto para caber na largura da coluna (com reticências).
  const encaixar = (txt: string, w: number) => {
    const max = w - 8;
    if (doc.getTextWidth(txt) <= max) return txt;
    let t = txt;
    while (t.length > 1 && doc.getTextWidth(`${t}…`) > max) t = t.slice(0, -1);
    return `${t}…`;
  };

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let zebra = false;
  for (const r of rows) {
    if (y + 16 > bottom) {
      doc.addPage();
      y = 48;
      desenharColunas();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
    }
    if (zebra) {
      doc.setFillColor(ZEBRA[0], ZEBRA[1], ZEBRA[2]);
      doc.rect(marginX, y - 10, pageWidth - marginX * 2, 15, "F");
    }
    zebra = !zebra;
    let x = marginX + 6;
    for (const c of COLS) {
      let valor: string;
      if (c.key === "filiacao") {
        valor = r.filiado ? "Filiado" : "Não filiado";
        doc.setTextColor(
          r.filiado ? GREEN[0] : SLATE[0],
          r.filiado ? GREEN[1] : SLATE[1],
          r.filiado ? GREEN[2] : SLATE[2],
        );
      } else if (c.key === "local") {
        valor = r.local;
      } else {
        valor = String(r[c.key] ?? "");
        doc.setTextColor(20);
      }
      doc.text(encaixar(valor || "—", c.w), x, y);
      doc.setTextColor(20);
      x += c.w;
    }
    y += 15;
  }

  // Rodapé de uso restrito (LGPD) na última página.
  y += 8;
  if (y + 24 > bottom) {
    doc.addPage();
    y = 48;
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(
    doc.splitTextToSize(
      "Documento com dados pessoais — uso restrito à finalidade autorizada e à LGPD (Lei nº 13.709/2018). Não redistribua.",
      pageWidth - marginX * 2,
    ) as string[],
    marginX,
    y,
  );
  doc.setTextColor(20);

  const nome = `votantes-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(nome);
}
