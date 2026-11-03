import type { DiretoriaRow } from "@/lib/relatorio-diretoria";

// Relatório GERAL da diretoria em PDF — institucional, limpo, agrupado por ZONA
// e alfabético dentro de cada zona. Gera no cliente (jsPDF). O telefone (PII) só
// entra quando a página o inclui (permissão de votantes).

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

const ZONA_LABEL: Record<string, string> = {
  NORTE: "Zona Norte",
  SUL: "Zona Sul",
  LESTE: "Zona Leste",
  CENTRO: "Zona Centro",
  SUDESTE: "Zona Sudeste",
  RURAL: "Zona Rural",
};

export type DiretoriaPdfHeader = {
  logoSindserm: string;
  logoPleito: string | null;
  tituloPleito: string;
  geradoEm: string;
};

/** Texto do telefone na célula (com asterisco p/ match provável). */
function telCelula(r: DiretoriaRow): { txt: string; fraco: boolean } {
  if (r.telefone) return { txt: r.telefone + (r.confianca === "parcial" ? " *" : ""), fraco: r.confianca === "parcial" };
  if (r.confianca === "ambiguo") return { txt: "conferir", fraco: true };
  return { txt: "—", fraco: false };
}

export async function downloadDiretoriaPdf(
  rows: DiretoriaRow[],
  header: DiretoriaPdfHeader,
  incluiTelefone: boolean,
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

  const topo = () => {
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(0, 0, pageWidth, 88, "F");
    if (logoSind) {
      try {
        const p = doc.getImageProperties(logoSind);
        const s = Math.min(116 / p.width, 48 / p.height);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(marginX - 6, 14, p.width * s + 12, p.height * s + 12, 6, 6, "F");
        doc.addImage(logoSind, marginX, 20, p.width * s, p.height * s);
      } catch {
        /* ignora */
      }
    }
    if (logoPleito) {
      try {
        const p = doc.getImageProperties(logoPleito);
        const s = Math.min(46 / p.width, 46 / p.height);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pageWidth - marginX - p.width * s - 6, 20, p.width * s + 12, p.height * s + 12, 6, 6, "F");
        doc.addImage(logoPleito, pageWidth - marginX - p.width * s, 26, p.width * s, p.height * s);
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
    doc.text("Relatório Geral da Diretoria — Representantes Eleitos", pageWidth / 2, 54, { align: "center" });
    doc.setFontSize(8.5);
    doc.text(`Gerado em ${header.geradoEm}`, pageWidth / 2, 70, { align: "center" });
    doc.setTextColor(INK[0], INK[1], INK[2]);
  };

  topo();
  let y = 108;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  for (const ln of doc.splitTextToSize(header.tituloPleito, contentW) as string[]) {
    doc.text(ln, marginX, y);
    y += 15;
  }
  const zonas = new Set(rows.map((r) => r.zona)).size;
  const comTel = rows.filter((r) => r.telefone).length;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(
    `${rows.length} representante(s) eleito(s) · ${zonas} zona(s)` +
      (incluiTelefone ? ` · ${comTel} com telefone` : ""),
    marginX,
    y,
  );
  y += 12;
  if (incluiTelefone) {
    doc.setFontSize(8);
    doc.text(
      "Telefone cruzado do votante homônimo do mesmo local. * = provável (confira). Uso interno (LGPD).",
      marginX,
      y,
    );
    y += 12;
  }
  doc.setTextColor(INK[0], INK[1], INK[2]);
  y += 6;

  if (rows.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.text("Nenhum representante eleito até o momento.", marginX, y + 8);
    doc.save(`relatorio-diretoria-${new Date().toISOString().slice(0, 10)}.pdf`);
    return;
  }

  const ensure = (need: number) => {
    if (y + need > bottom) {
      doc.addPage();
      y = 48;
    }
  };

  // Agrupa por zona (as rows já vêm ordenadas por zona e por nome).
  const porZona = new Map<string, DiretoriaRow[]>();
  for (const r of rows) {
    const arr = porZona.get(r.zona) ?? [];
    arr.push(r);
    porZona.set(r.zona, arr);
  }

  const telX = pageWidth - marginX - 6;
  for (const [zona, itens] of porZona) {
    ensure(34);
    // Cabeçalho da zona (faixa cinza calma).
    doc.setFillColor(GROUP_BG[0], GROUP_BG[1], GROUP_BG[2]);
    doc.roundedRect(marginX, y - 10, contentW, 20, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(ZONA_LABEL[zona] ?? zona, marginX + 8, y + 3);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.text(`${itens.length} representante(s)`, pageWidth - marginX - 8, y + 3, { align: "right" });
    doc.setTextColor(INK[0], INK[1], INK[2]);
    y += 26;

    for (const r of itens) {
      ensure(26);
      // Marcador verde + nome.
      doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
      doc.circle(marginX + 4, y - 3, 1.6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      const maxNome = incluiTelefone ? contentW - 150 : contentW - 20;
      doc.text((doc.splitTextToSize(r.nome, maxNome) as string[])[0], marginX + 12, y);

      // Telefone à direita (se incluído).
      if (incluiTelefone) {
        const cel = telCelula(r);
        doc.setFont("helvetica", cel.fraco ? "italic" : "bold");
        doc.setFontSize(9);
        doc.setTextColor(cel.fraco ? SLATE[0] : INK[0], cel.fraco ? SLATE[1] : INK[1], cel.fraco ? SLATE[2] : INK[2]);
        doc.text(cel.txt, telX, y, { align: "right" });
      }

      // Lotação + órgão (linha de baixo, cinza).
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
      const lot = `${r.local} · ${r.orgao}`;
      doc.text((doc.splitTextToSize(lot, contentW - 30) as string[])[0], marginX + 12, y + 10);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      y += 22;
    }
    y += 8;
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `SEV SINDSERM · Relatório geral da diretoria${incluiTelefone ? " · uso interno (LGPD)" : ""} · Página ${p}/${total}`,
      pageWidth / 2,
      pageHeight - 22,
      { align: "center" },
    );
  }

  doc.save(`relatorio-diretoria-${new Date().toISOString().slice(0, 10)}.pdf`);
}
