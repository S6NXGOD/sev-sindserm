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

const RED: [number, number, number] = [193, 39, 45];
const AMBER: [number, number, number] = [180, 83, 9];
const ROSE: [number, number, number] = [190, 40, 40];
const SLATE: [number, number, number] = [100, 116, 139];
const GREEN: [number, number, number] = [16, 122, 76];

// Limite de itens listados por seção (evita PDF gigante).
const CAP = 300;

type Item = Apuracao;

/**
 * RELATÓRIO DE PENDÊNCIAS E AJUSTES (para a diretoria decidir). Agrupa os locais
 * ENCERRADOS que precisam de decisão — empates, sem votação, sem eleito e vaga
 * parcial — com a AÇÃO RECOMENDADA de cada caso. Gera 100% no cliente (jsPDF).
 */
export async function downloadRelatorioPendencias(
  data: ReportData,
  header: ApuracaoPdfHeader,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 44;
  const bottom = pageHeight - 54;
  const contentW = pageWidth - marginX * 2;

  const [logoSind, logoPleito] = await Promise.all([
    fetchPngDataUrl(header.logoSindserm),
    header.logoPleito ? fetchPngDataUrl(header.logoPleito) : null,
  ]);

  // ---- BUCKETS (só encerrados; exclui os já resolvidos onde faz sentido) ------
  const encerrados = data.apuracoes.filter((a) => a.status === "closed");
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
  const pendencias =
    empates.length + semVoto.length + semEleitoComVoto.length + vagaParcial.length;

  // ---- Cabeçalho institucional (faixa vermelha + logos) -----------------------
  const desenharTopo = () => {
    doc.setFillColor(RED[0], RED[1], RED[2]);
    doc.rect(0, 0, pageWidth, 92, "F");
    const drawLogo = (
      dataUrl: string,
      x: number,
      maxW: number,
      maxH: number,
      rightAlign = false,
    ) => {
      try {
        const props = doc.getImageProperties(dataUrl);
        const scale = Math.min(maxW / props.width, maxH / props.height);
        const w = props.width * scale;
        const h = props.height * scale;
        const px = rightAlign ? x - w : x;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(px - 6, 20 - 6 + (maxH - h) / 2, w + 12, h + 12, 6, 6, "F");
        doc.addImage(dataUrl, px, 20 + (maxH - h) / 2, w, h);
      } catch {
        /* logo inválida: ignora */
      }
    };
    if (logoSind) drawLogo(logoSind, marginX, 120, 52);
    if (logoPleito) drawLogo(logoPleito, pageWidth - marginX, 48, 48, true);
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
    doc.setTextColor(20);
  };
  desenharTopo();

  const s = { y: 112 };
  const ensureSpace = (need: number) => {
    if (s.y + need > bottom) {
      doc.addPage();
      desenharTopo();
      s.y = 112;
    }
  };
  const par = (t: string, size = 9.5, cor = 70, x = marginX, indent = 0) => {
    for (const ln of doc.splitTextToSize(t, contentW - indent) as string[]) {
      ensureSpace(13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(size);
      doc.setTextColor(cor);
      doc.text(ln, x + indent, s.y);
      s.y += 12;
    }
    doc.setTextColor(20);
  };
  const secao = (
    titulo: string,
    cor: [number, number, number],
    qtd: number,
  ) => {
    s.y += 8;
    ensureSpace(30);
    doc.setFillColor(cor[0], cor[1], cor[2]);
    doc.roundedRect(marginX, s.y - 12, contentW, 22, 4, 4, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${titulo} (${qtd})`, marginX + 10, s.y + 3);
    doc.setTextColor(20);
    s.y += 26;
  };
  const localHead = (a: Item) => {
    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(20);
    doc.text(
      (doc.splitTextToSize(a.nome, contentW) as string[])[0],
      marginX,
      s.y,
    );
    s.y += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(SLATE[0], SLATE[1], SLATE[2]);
    doc.text(
      `${a.orgao} · Zona ${a.zona}${a.rodadaAtual > 1 ? ` · ${a.rodadaAtual}ª rodada` : ""}`,
      marginX,
      s.y,
    );
    doc.setTextColor(20);
    s.y += 13;
  };
  const acao = (t: string) => {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.text("Ação recomendada:", marginX, s.y);
    doc.setTextColor(20);
    s.y += 11;
    par(t, 9, 70, marginX, 0);
    s.y += 4;
  };
  const vazio = () => {
    ensureSpace(14);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.text("Nenhum — tudo certo aqui.", marginX + 2, s.y);
    doc.setTextColor(20);
    s.y += 16;
  };

  // ---- Abertura + resumo ------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(
    doc.splitTextToSize(header.tituloPleito, contentW) as string[],
    marginX,
    s.y,
  );
  s.y += 18;
  par(
    "Este relatório reúne os locais de votação JÁ ENCERRADOS que precisam de uma decisão da diretoria, " +
      "agrupados por tipo, com a ação recomendada para cada caso. Serve de base para deliberação e registro em ata.",
    9.5,
    70,
  );
  s.y += 4;

  secao("RESUMO", [30, 41, 59], pendencias);
  const linhaResumo = (label: string, n: number) => {
    ensureSpace(15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(label, marginX + 4, s.y);
    doc.setFont("helvetica", "bold");
    doc.text(String(n), pageWidth - marginX - 4, s.y, { align: "right" });
    s.y += 14;
  };
  linhaResumo("Locais encerrados", encerrados.length);
  linhaResumo("Empates a desempatar", empates.length);
  linhaResumo("Encerrados sem nenhuma votação", semVoto.length);
  linhaResumo("Encerrados com votos, mas sem eleito", semEleitoComVoto.length);
  linhaResumo("Com vaga(s) sem eleito (parcial)", vagaParcial.length);
  linhaResumo("Já resolvidos (vagas vazias aceitas)", resolvidos);
  s.y += 2;

  // ---- 1) Empates -------------------------------------------------------------
  secao("EMPATES A DESEMPATAR", AMBER, empates.length);
  if (empates.length === 0) vazio();
  empates.slice(0, CAP).forEach((a) => {
    localHead(a);
    const nomes = a.empatados.join(", ");
    par(
      `${a.empatados.length} candidato(s) empatados com ${a.empatadosVotos ?? 0} voto(s) cada, ` +
        `disputando ${a.vagasEmDisputa} vaga(s): ${nomes}.`,
      9.5,
      40,
    );
    acao(
      "Desempate conforme o estatuto/Art. 24 do Regimento (Diretoria Colegiada), registrado em ata. " +
        "Depois, abra o local e marque quem NÃO assume (motivo: Desempate) — o suplente é promovido automaticamente.",
    );
  });

  // ---- 2) Sem votação ---------------------------------------------------------
  secao("ENCERRADOS SEM NENHUMA VOTAÇÃO", ROSE, semVoto.length);
  if (semVoto.length === 0) vazio();
  semVoto.slice(0, CAP).forEach((a) => {
    localHead(a);
    par(
      a.totalCandidatos === 0
        ? "Encerrou sem candidatos cadastrados e sem votos."
        : `${a.totalCandidatos} candidato(s) cadastrado(s), mas nenhum voto foi registrado.`,
      9.5,
      40,
    );
    acao(
      "Sem votos. Avalie: (a) reabrir/abrir nova rodada (suplementar) com nova convocação; " +
        "(b) eleição por aclamação no local de trabalho (Art. 9º-b), com ata; ou (c) manter sem representante, registrando a decisão.",
    );
  });

  // ---- 3) Com votos, sem eleito ----------------------------------------------
  secao("ENCERRADOS COM VOTOS, MAS SEM ELEITO", ROSE, semEleitoComVoto.length);
  if (semEleitoComVoto.length === 0) vazio();
  semEleitoComVoto.slice(0, CAP).forEach((a) => {
    localHead(a);
    const renunc = a.renunciantes.length
      ? ` Não assumiram: ${a.renunciantes.map((r) => r.nome).join(", ")}.`
      : "";
    par(
      `Houve ${a.totalVotos} voto(s), mas nenhum candidato assumiu a vaga.${renunc}`,
      9.5,
      40,
    );
    acao(
      "Avalie abrir uma suplementar (nova rodada) para preencher a(s) vaga(s), ou registrar a decisão de manter sem representante.",
    );
  });

  // ---- 4) Vaga parcial --------------------------------------------------------
  secao("COM VAGA(S) SEM ELEITO (PARCIAL)", SLATE, vagaParcial.length);
  if (vagaParcial.length === 0) vazio();
  vagaParcial.slice(0, CAP).forEach((a) => {
    localHead(a);
    par(
      `Elegeu ${a.eleitos.length} de ${a.vagas} vaga(s); ${a.vagasVazias} vaga(s) sem eleito. ` +
        `Eleitos: ${a.eleitos.slice(0, 8).join(", ")}${a.eleitos.length > 8 ? "…" : ""}.`,
      9.5,
      40,
    );
    acao(
      "Vaga vazia costuma ser natural (menos candidatos/votos que vagas). Avalie abrir suplementar para as vagas restantes " +
        "OU aceitar as vagas vazias (finaliza sem suplementar) — a decisão fica registrada.",
    );
  });

  // ---- Rodapé institucional ---------------------------------------------------
  s.y += 8;
  ensureSpace(24);
  doc.setDrawColor(210);
  doc.line(marginX, s.y, pageWidth - marginX, s.y);
  s.y += 12;
  par(
    "Documento interno de apoio à decisão da Diretoria Colegiada do SINDSERM. Reflete os dados no momento da geração e " +
      "não substitui a ata oficial da comissão eleitoral. As decisões tomadas devem ser registradas em ata.",
    8,
    120,
  );

  doc.save(
    `pendencias-pleito-${header.tituloPleito.match(/\d{4}/)?.[0] ?? "sindserm"}.pdf`,
  );
}
