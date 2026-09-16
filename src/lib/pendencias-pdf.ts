import type { jsPDF } from "jspdf";
import type { Apuracao, ReportData } from "@/lib/reports";
import type { ApuracaoPdfHeader } from "@/lib/apuracao-report-pdf";

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

type RGB = [number, number, number];
const RED: RGB = [193, 39, 45];
const AMBER: RGB = [180, 83, 9];
const AMBER_SOFT: RGB = [254, 243, 219];
const ROSE: RGB = [190, 40, 40];
const ROSE_SOFT: RGB = [253, 232, 232];
const SLATE: RGB = [71, 85, 105];
const SLATE_SOFT: RGB = [241, 245, 249];
const GREEN: RGB = [16, 122, 76];
const INK: RGB = [30, 41, 59];

const CAP = 400;

type Item = Apuracao;

/**
 * RELATÓRIO DE PENDÊNCIAS E AJUSTES — redesenhado para SCANNABILIDADE: um painel
 * de resumo com contadores coloridos, e cada categoria com a AÇÃO uma única vez
 * + a lista dos locais em linhas alternadas (zebra). Gera 100% no cliente.
 */
export async function downloadRelatorioPendencias(
  data: ReportData,
  header: ApuracaoPdfHeader,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const M = 44;
  const bottom = pageHeight - 52;
  const W = pageWidth - M * 2;

  const [logoSind, logoPleito] = await Promise.all([
    fetchPngDataUrl(header.logoSindserm),
    header.logoPleito ? fetchPngDataUrl(header.logoPleito) : null,
  ]);

  // Locais encerrados; dispensados (sem representação por decisão) saem das
  // pendências — a diretoria já decidiu não ter representante ali.
  const encerrados = data.apuracoes.filter(
    (a) => a.status === "closed" && !a.semRepresentacao,
  );
  const ord = (a: Item, b: Item) =>
    a.orgao.localeCompare(b.orgao) || a.nome.localeCompare(b.nome);
  const empates = encerrados.filter((a) => a.temEmpate).sort(ord);
  const semVoto = encerrados
    .filter((a) => !a.temEmpate && a.totalVotos === 0 && !a.vagasVaziasAceitas)
    .sort(ord);
  const semEleitoComVoto = encerrados
    .filter(
      (a) =>
        !a.temEmpate &&
        a.totalVotos > 0 &&
        a.eleitos.length === 0 &&
        !a.vagasVaziasAceitas,
    )
    .sort(ord);
  const vagaParcial = encerrados
    .filter(
      (a) =>
        !a.temEmpate &&
        a.eleitos.length > 0 &&
        a.vagasVazias > 0 &&
        !a.vagasVaziasAceitas,
    )
    .sort(ord);
  const resolvidos = encerrados.filter((a) => a.vagasVaziasAceitas).length;
  const dispensados = data.apuracoes.filter((a) => a.semRepresentacao).length;
  const totalPend =
    empates.length + semVoto.length + semEleitoComVoto.length + vagaParcial.length;

  // ---------------------------- Cabeçalho -----------------------------------
  const topo = () => {
    doc.setFillColor(...RED);
    doc.rect(0, 0, pageWidth, 92, "F");
    const logo = (u: string, x: number, mw: number, mh: number, right = false) => {
      try {
        const p = doc.getImageProperties(u);
        const sc = Math.min(mw / p.width, mh / p.height);
        const w = p.width * sc;
        const h = p.height * sc;
        const px = right ? x - w : x;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(px - 6, 20 - 6 + (mh - h) / 2, w + 12, h + 12, 6, 6, "F");
        doc.addImage(u, px, 20 + (mh - h) / 2, w, h);
      } catch {
        /* ignora */
      }
    };
    if (logoSind) logo(logoSind, M, 120, 52);
    if (logoPleito) logo(logoPleito, pageWidth - M, 48, 48, true);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("SEV SINDSERM", pageWidth / 2, 40, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Relatório de Pendências e Ajustes", pageWidth / 2, 58, {
      align: "center",
    });
    doc.setFontSize(8.5);
    doc.text(`Gerado em ${header.geradoEm}`, pageWidth / 2, 74, {
      align: "center",
    });
    doc.setTextColor(...INK);
  };
  topo();

  const s = { y: 112 };
  const ensure = (need: number) => {
    if (s.y + need > bottom) {
      doc.addPage();
      topo();
      s.y = 112;
    }
  };
  const wrap = (t: string, size: number, maxW: number): string[] => {
    doc.setFontSize(size);
    return doc.splitTextToSize(t, maxW) as string[];
  };

  // Título do pleito + intro curta.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...INK);
  for (const ln of wrap(header.tituloPleito, 12.5, W)) {
    doc.text(ln, M, s.y);
    s.y += 15;
  }
  s.y += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  for (const ln of wrap(
    "Locais ENCERRADOS que precisam de decisão da diretoria. Cada categoria traz a ação recomendada uma vez, seguida dos locais. Registre as decisões em ata.",
    9,
    W,
  )) {
    doc.text(ln, M, s.y);
    s.y += 11;
  }
  s.y += 8;

  // ---------------------- Painel de resumo (stat cards) ----------------------
  const stats: { n: number; label: string; cor: RGB; soft: RGB }[] = [
    { n: empates.length, label: "Empates", cor: AMBER, soft: AMBER_SOFT },
    { n: semVoto.length, label: "Sem votação", cor: ROSE, soft: ROSE_SOFT },
    { n: semEleitoComVoto.length, label: "Votos, sem eleito", cor: ROSE, soft: ROSE_SOFT },
    { n: vagaParcial.length, label: "Vaga parcial", cor: SLATE, soft: SLATE_SOFT },
  ];
  const gap = 10;
  const cw = (W - gap * 3) / 4;
  const ch = 52;
  ensure(ch + 26);
  // Faixa de contexto.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text(
    `${encerrados.length} locais encerrados · ${totalPend} pendência(s) · ${resolvidos} já resolvido(s)` +
      (dispensados > 0 ? ` · ${dispensados} sem representação` : ""),
    M,
    s.y,
  );
  s.y += 10;
  stats.forEach((st, i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(...st.soft);
    doc.roundedRect(x, s.y, cw, ch, 6, 6, "F");
    doc.setFillColor(...st.cor);
    doc.roundedRect(x, s.y, 4, ch, 2, 2, "F"); // faixa lateral colorida
    doc.setTextColor(...st.cor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(String(st.n), x + 12, s.y + 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    for (const [j, ln] of (doc.splitTextToSize(st.label, cw - 18) as string[])
      .slice(0, 2)
      .entries()) {
      doc.text(ln, x + 12, s.y + 38 + j * 9);
    }
  });
  s.y += ch + 14;
  doc.setTextColor(...INK);

  // --------------------------- Renderer de seção -----------------------------
  const secao = (
    titulo: string,
    cor: RGB,
    soft: RGB,
    itens: Item[],
    acaoTexto: string,
    linha: (a: Item) => { diag: string },
  ) => {
    s.y += 10;
    ensure(30);
    // Cabeçalho da seção (barra colorida).
    doc.setFillColor(...cor);
    doc.roundedRect(M, s.y - 12, W, 22, 4, 4, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${titulo}`, M + 10, s.y + 3);
    doc.text(`${itens.length}`, pageWidth - M - 10, s.y + 3, { align: "right" });
    doc.setTextColor(...INK);
    s.y += 24;

    if (itens.length === 0) {
      ensure(16);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9.5);
      doc.setTextColor(...GREEN);
      doc.text("Nenhum — tudo certo aqui.", M + 2, s.y);
      doc.setTextColor(...INK);
      s.y += 16;
      return;
    }

    // AÇÃO — uma única vez, em caixa suave (não repete por local).
    const acaoLns = wrap(acaoTexto, 9, W - 24);
    const acaoH = 16 + acaoLns.length * 11;
    ensure(acaoH + 6);
    doc.setFillColor(...soft);
    doc.roundedRect(M, s.y, W, acaoH, 5, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...cor);
    doc.text("O QUE FAZER", M + 12, s.y + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60);
    let ay = s.y + 25;
    for (const ln of acaoLns) {
      doc.text(ln, M + 12, ay);
      ay += 11;
    }
    doc.setTextColor(...INK);
    s.y += acaoH + 10;

    // Lista dos locais (zebra).
    itens.slice(0, CAP).forEach((a, i) => {
      const meta = `${a.orgao} · Zona ${a.zona}${a.rodadaAtual > 1 ? ` · ${a.rodadaAtual}ª rodada` : ""}`;
      const diag = linha(a).diag;
      const diagLns = wrap(diag, 8.5, W - 24);
      const rowH = 26 + diagLns.length * 10;
      ensure(rowH + 2);
      if (i % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(M, s.y - 2, W, rowH, 3, 3, "F");
      }
      // acento lateral
      doc.setFillColor(...cor);
      doc.roundedRect(M, s.y - 1, 3, rowH - 2, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(wrap(a.nome, 10, W - 24)[0], M + 12, s.y + 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SLATE);
      doc.text(meta, M + 12, s.y + 20);
      doc.setFontSize(8.5);
      doc.setTextColor(70);
      let dy = s.y + 30;
      for (const ln of diagLns) {
        doc.text(ln, M + 12, dy);
        dy += 10;
      }
      doc.setTextColor(...INK);
      s.y += rowH + 3;
    });
    if (itens.length > CAP) {
      ensure(12);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(...SLATE);
      doc.text(`+ ${itens.length - CAP} local(is) não listado(s).`, M + 12, s.y);
      doc.setTextColor(...INK);
      s.y += 12;
    }
  };

  // ------------------------------ Seções -------------------------------------
  secao(
    "EMPATES A DESEMPATAR",
    AMBER,
    AMBER_SOFT,
    empates,
    "Desempate pela Diretoria Colegiada (Art. 24 do Regimento), registrado em ata. Depois, no sistema, abra o local e marque quem NÃO assume (motivo: Desempate) — o suplente é promovido automaticamente.",
    (a) => ({
      diag: `${a.empatados.length} empatados com ${a.empatadosVotos ?? 0} voto(s) cada, por ${a.vagasEmDisputa} vaga(s): ${a.empatados.join(", ")}.`,
    }),
  );

  secao(
    "ENCERRADOS SEM NENHUMA VOTAÇÃO",
    ROSE,
    ROSE_SOFT,
    semVoto,
    "Sem votos. Avalie: reabrir/abrir suplementar com nova convocação; eleição por aclamação no local (Art. 9º-b), com ata; ou manter sem representante, registrando a decisão.",
    (a) => ({
      diag:
        a.totalCandidatos === 0
          ? "Sem candidatos cadastrados e sem votos."
          : `${a.totalCandidatos} candidato(s), mas nenhum voto registrado.`,
    }),
  );

  secao(
    "ENCERRADOS COM VOTOS, MAS SEM ELEITO",
    ROSE,
    ROSE_SOFT,
    semEleitoComVoto,
    "Houve votos, mas ninguém assumiu (renúncias). Avalie abrir suplementar ou registrar a decisão de manter sem representante.",
    (a) => ({
      diag: `${a.totalVotos} voto(s); nenhum candidato assumiu.${a.renunciantes.length ? ` Não assumiram: ${a.renunciantes.map((r) => r.nome).join(", ")}.` : ""}`,
    }),
  );

  secao(
    "COM VAGA(S) SEM ELEITO (PARCIAL)",
    SLATE,
    SLATE_SOFT,
    vagaParcial,
    "Vaga vazia costuma ser natural (menos candidatos/votos que vagas). Avalie abrir suplementar para as restantes OU aceitar as vagas vazias (finaliza) — a decisão fica registrada.",
    (a) => ({
      diag: `Elegeu ${a.eleitos.length} de ${a.vagas} vaga(s); ${a.vagasVazias} sem eleito. Eleitos: ${a.eleitos.slice(0, 6).join(", ")}${a.eleitos.length > 6 ? "…" : ""}.`,
    }),
  );

  // ------------------------------ Rodapé -------------------------------------
  s.y += 10;
  ensure(24);
  doc.setDrawColor(210);
  doc.line(M, s.y, pageWidth - M, s.y);
  s.y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120);
  for (const ln of wrap(
    "Documento interno de apoio à decisão da Diretoria Colegiada do SINDSERM. Reflete os dados no momento da geração e não substitui a ata oficial da comissão eleitoral. As decisões devem ser registradas em ata.",
    8,
    W,
  )) {
    ensure(11);
    doc.text(ln, M, s.y);
    s.y += 10;
  }
  doc.setTextColor(...INK);

  doc.save(
    `pendencias-pleito-${header.tituloPleito.match(/\d{4}/)?.[0] ?? "sindserm"}.pdf`,
  );
}
