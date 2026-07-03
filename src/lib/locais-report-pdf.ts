import type { LocaisReportData } from "@/lib/actions/admin";

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

// Paleta SINDSERM (vermelho institucional).
const RED: [number, number, number] = [193, 39, 45];
const RED_SOFT: [number, number, number] = [252, 232, 233];
const GREEN: [number, number, number] = [22, 122, 76];

/**
 * Gera (no cliente) o PDF PERSONALIZADO do relatório de locais: cabeçalho com a
 * logo do SINDSERM e faixa vermelha institucional, filtros/opções aplicados e,
 * por local, os votantes/filiados e/ou candidatos (conforme marcado).
 */
export async function downloadLocaisReportPdf(data: LocaisReportData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 44;
  const bottom = pageHeight - 44;
  const contentW = pageWidth - marginX * 2;

  const logo = await fetchPngDataUrl(data.logoSindserm);

  const desenharTopo = () => {
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(0, 0, pageWidth, 92, "F");
    if (logo) {
      try {
        const props = doc.getImageProperties(logo);
        const maxH = 52;
        const maxW = 120;
        const scale = Math.min(maxW / props.width, maxH / props.height);
        const w = props.width * scale;
        const h = props.height * scale;
        const ly = 20 + (maxH - h) / 2;
        // fundo branco arredondado atrás da logo (funciona com logos coloridas)
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(marginX - 6, ly - 6, w + 12, h + 12, 6, 6, "F");
        doc.addImage(logo, marginX, ly, w, h);
      } catch {
        /* logo invalida (ex.: SVG): ignora */
      }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("SEV SINDSERM", pageWidth - marginX, 40, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Relatório de Locais de Trabalho", pageWidth - marginX, 58, {
      align: "right",
    });
    doc.setFontSize(8.5);
    doc.text(`Gerado em ${data.geradoEm}`, pageWidth - marginX, 74, {
      align: "right",
    });
    doc.setTextColor(20);
  };

  desenharTopo();

  let y = 112;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Filtros:", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(data.filtros, contentW - 46), marginX + 44, y);
  y += 15;

  const incl: string[] = [];
  if (data.incluiFiliados)
    incl.push(data.somenteFiliados ? "Somente filiados" : "Todos os votantes");
  if (data.incluiCandidatos) incl.push("Candidatos");
  doc.setFont("helvetica", "bold");
  doc.text("Inclui:", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    incl.length ? incl.join(" · ") : "Apenas a lista de locais",
    marginX + 44,
    y,
  );
  y += 15;

  doc.setTextColor(90);
  doc.setFontSize(9);
  doc.text(
    `${data.totalLocais} local(is) · ${data.totalVotantes} votante(s) · ${data.totalCandidatos} candidato(s)`,
    marginX,
    y,
  );
  doc.setTextColor(20);
  y += 12;
  doc.setDrawColor(220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;

  const ensureSpace = (need: number) => {
    if (y + need > bottom) {
      doc.addPage();
      y = 48;
    }
  };

  const subLista = (
    titulo: string,
    linhas: { texto: string; badge?: string }[],
  ) => {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(40);
    doc.text(`${titulo} (${linhas.length})`, marginX + 4, y);
    y += 14;
    doc.setFontSize(9);
    doc.setTextColor(30);
    if (linhas.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120);
      doc.text("Nenhum.", marginX + 8, y);
      doc.setTextColor(30);
      doc.setFont("helvetica", "normal");
      y += 14;
      return;
    }
    doc.setFont("helvetica", "normal");
    linhas.forEach((l) => {
      ensureSpace(13);
      const w = l.badge ? contentW - 70 : contentW - 20;
      const partes = doc.splitTextToSize(l.texto, w) as string[];
      doc.text(partes, marginX + 8, y);
      if (l.badge) {
        doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
        doc.setFont("helvetica", "bold");
        doc.text(l.badge, pageWidth - marginX - 4, y, { align: "right" });
        doc.setTextColor(30);
        doc.setFont("helvetica", "normal");
      }
      y += 12 + (partes.length - 1) * 11;
    });
    y += 6;
  };

  for (const l of data.locais) {
    ensureSpace(60);
    // Cabeçalho do local (barra vermelha suave).
    doc.setFillColor(RED_SOFT[0], RED_SOFT[1], RED_SOFT[2]);
    doc.roundedRect(marginX, y - 12, contentW, 32, 4, 4, "F");
    doc.setTextColor(RED[0], RED[1], RED[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text(
      (doc.splitTextToSize(l.nome, contentW - 16) as string[])[0],
      marginX + 10,
      y + 1,
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90);
    doc.text(`${l.orgao} · Zona ${l.zona} · ${l.status}`, marginX + 10, y + 13);
    doc.setTextColor(20);
    y += 34;

    if (data.incluiFiliados) {
      subLista(
        data.somenteFiliados ? "Filiados" : "Votantes",
        l.votantes.map((v) => {
          const contato = [v.telefone, v.email].filter(Boolean).join(" · ");
          return {
            texto: contato ? `${v.nome}  —  ${contato}` : v.nome,
            badge: v.isFiliado ? "Filiado" : undefined,
          };
        }),
      );
    }
    if (data.incluiCandidatos) {
      subLista(
        "Candidatos",
        l.candidatos.map((nome) => ({ texto: nome })),
      );
    }
    y += 4;
  }

  if (data.truncado) {
    ensureSpace(24);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(150);
    doc.text(
      doc.splitTextToSize(
        "Lista extensa: parte dos registros foi omitida neste PDF. Use a exportação CSV para a relação completa.",
        contentW,
      ),
      marginX,
      y,
    );
    doc.setTextColor(20);
  }

  doc.save(`relatorio-locais-${new Date().toISOString().slice(0, 10)}.pdf`);
}
