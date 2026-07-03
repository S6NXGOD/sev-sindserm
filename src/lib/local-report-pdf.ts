import type { ManagerData } from "@/components/admin/workplace-manager";

const STATUS_LABEL: Record<ManagerData["status"], string> = {
  open: "Votação em andamento",
  closed: "Votação encerrada",
  upcoming: "Não iniciada",
};

/**
 * Gera (no cliente) o PDF do RELATÓRIO de UM local de trabalho a partir dos
 * dados já apurados no gerenciador: cabeçalho, janela/contadores, eleitos
 * (parcial ou definitivo) e o ranking dos mais votados.
 */
export async function downloadLocalReportPdf(data: ManagerData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const bottom = pageHeight - 48;
  const centerX = pageWidth / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SEV SINDSERM", centerX, 56, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(
    "Sistema Eletrônico de Votação do SINDSERM · Relatório do Local",
    centerX,
    70,
    { align: "center" },
  );

  let y = 92;
  doc.setDrawColor(210);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(doc.splitTextToSize(data.nome, pageWidth - marginX * 2), marginX, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${data.orgao} · Zona ${data.zona}`, marginX, y);
  y += 14;
  doc.text(
    `Janela: ${data.inicioDisplay} até ${data.fimDisplay} · ${STATUS_LABEL[data.status]}`,
    marginX,
    y,
  );
  y += 14;
  doc.text(
    `${data.totalCandidatos} candidato(s) · ${data.vagas} vaga(s) · ${data.totalVotes} voto(s)`,
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
    itens: { nome: string; votos: number; pct?: number }[],
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
      doc.text(
        doc.splitTextToSize(`${i + 1}. ${c.nome}`, pageWidth - marginX * 2 - 90),
        marginX + 4,
        y,
      );
      doc.setFont("helvetica", "bold");
      const right =
        c.pct !== undefined
          ? `${c.votos} voto(s) · ${c.pct}%`
          : `${c.votos} voto(s)`;
      doc.text(right, pageWidth - marginX - 4, y, { align: "right" });
      y += 16;
    });
    y += 8;
  };

  secao(
    data.status === "closed"
      ? "ELEITOS (TITULARES)"
      : "ELEITOS (PARCIAL / PROJEÇÃO)",
    data.eleitos,
    [16, 122, 76],
  );
  secao("RANKING (MAIS VOTADOS)", data.ranking, [51, 65, 85]);

  ensureSpace(16);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(120);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} · documento interno.`,
    marginX,
    y,
  );

  doc.save(
    `relatorio-${data.nome
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}.pdf`,
  );
}
