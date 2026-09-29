import type { jsPDF } from "jspdf";
import type { EleitoRow } from "@/lib/transparencia";

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
const GROUP_BG: [number, number, number] = [241, 245, 249]; // slate-100 (calmo)

export type EleitosPdfHeader = {
  logoSindserm: string;
  logoPleito: string | null;
  titulo: string;
  geradoEm: string;
};

/**
 * LISTA OFICIAL DOS ELEITOS — PDF limpo e calmo (sem "parede vermelha"): só o
 * cabeçalho institucional usa a faixa da marca; o corpo é branco, com um
 * subcabeçalho cinza por órgão e uma linha por eleito. Gera no cliente (jsPDF).
 */
export async function downloadEleitosPdf(
  rows: EleitoRow[],
  header: EleitosPdfHeader,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 44;
  const bottom = pageHeight - 40;
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
        const maxH = 48;
        const scale = Math.min(116 / p.width, maxH / p.height);
        const w = p.width * scale;
        const h = p.height * scale;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(marginX - 6, 20 - 6, w + 12, h + 12, 6, 6, "F");
        doc.addImage(logoSind, marginX, 20, w, h);
      } catch {
        /* ignora */
      }
    }
    if (logoPleito) {
      try {
        const p = doc.getImageProperties(logoPleito);
        const maxH = 46;
        const scale = Math.min(46 / p.width, maxH / p.height);
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
    doc.text("Lista Oficial dos Eleitos", pageWidth / 2, 56, { align: "center" });
    doc.setFontSize(8.5);
    doc.text(`Gerado em ${header.geradoEm}`, pageWidth / 2, 72, {
      align: "center",
    });
    doc.setTextColor(INK[0], INK[1], INK[2]);
  };

  topo();
  let y = 110;

  // Título do pleito + resumo (texto simples, sem caixa colorida).
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  for (const ln of doc.splitTextToSize(header.titulo, contentW) as string[]) {
    doc.text(ln, marginX, y);
    y += 15;
  }
  const locais = new Set(rows.map((r) => r.local)).size;
  const orgaos = new Set(rows.map((r) => r.orgao)).size;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
  doc.text(
    `${rows.length} representante(s) eleito(s) · ${locais} local(is) · ${orgaos} órgão(s)`,
    marginX,
    y,
  );
  doc.setTextColor(INK[0], INK[1], INK[2]);
  y += 14;

  if (rows.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.text("Nenhum eleito definido até o momento.", marginX, y + 10);
    doc.save(`eleitos-${new Date().toISOString().slice(0, 10)}.pdf`);
    return;
  }

  // Agrupa por órgão → local (ordenado); dentro do local, mais votos primeiro.
  const porOrgao = new Map<string, EleitoRow[]>();
  for (const r of rows) {
    const arr = porOrgao.get(r.orgao) ?? [];
    arr.push(r);
    porOrgao.set(r.orgao, arr);
  }
  const grupos = [...porOrgao.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "pt"),
  );

  const ensure = (need: number) => {
    if (y + need > bottom) {
      doc.addPage();
      y = 48;
    }
  };

  for (const [orgao, itens] of grupos) {
    itens.sort(
      (a, b) => a.local.localeCompare(b.local, "pt") || b.votos - a.votos,
    );
    ensure(30);
    // Subcabeçalho do órgão — cinza calmo.
    doc.setFillColor(GROUP_BG[0], GROUP_BG[1], GROUP_BG[2]);
    doc.roundedRect(marginX, y - 10, contentW, 20, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(
      (doc.splitTextToSize(orgao, contentW - 70) as string[])[0],
      marginX + 8,
      y + 3,
    );
    doc.setFont("helvetica", "normal");
    doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.text(`${itens.length} eleito(s)`, pageWidth - marginX - 8, y + 3, {
      align: "right",
    });
    doc.setTextColor(INK[0], INK[1], INK[2]);
    y += 24;

    let localAtual = "";
    for (const e of itens) {
      // Rótulo do local quando muda (leve, cinza).
      if (e.local !== localAtual) {
        localAtual = e.local;
        ensure(14);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
        doc.text(
          (doc.splitTextToSize(
            `${e.local} · Zona ${e.zona}`,
            contentW - 10,
          ) as string[])[0],
          marginX + 6,
          y,
        );
        doc.setTextColor(INK[0], INK[1], INK[2]);
        y += 12;
      }
      ensure(13);
      // Marcador verde (accent) + nome + votos à direita.
      doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
      doc.circle(marginX + 12, y - 3, 1.6, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(
        (doc.splitTextToSize(e.eleito, contentW - 90) as string[])[0],
        marginX + 20,
        y,
      );
      doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
      doc.text(
        `${e.votos} ${e.votos === 1 ? "voto" : "votos"}`,
        pageWidth - marginX - 6,
        y,
        { align: "right" },
      );
      doc.setTextColor(INK[0], INK[1], INK[2]);
      y += 13;
    }
    y += 8;
  }

  // Rodapé com paginação.
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `SEV SINDSERM · Lista oficial dos eleitos · Página ${p}/${total}`,
      pageWidth / 2,
      pageHeight - 22,
      { align: "center" },
    );
  }

  doc.save(`eleitos-${new Date().toISOString().slice(0, 10)}.pdf`);
}
