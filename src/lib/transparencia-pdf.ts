import type { jsPDF } from "jspdf";
import type {
  RelatorioTransparencia,
  ResultadoLocal,
  RodadaArquivada,
} from "@/lib/transparencia";

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

function formatData(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const nf = (n: number) => n.toLocaleString("pt-BR");

export type PdfPleito = {
  titulo: string;
  trienio: string;
  logoSindserm: string;
  logoPleito: string | null;
  /** Canal oficial (rodapé "como contestar"). Opcional. */
  emailOficial?: string | null;
};

type LogoPair = { sindserm: string | null; pleito: string | null };

async function loadLogos(pleito: {
  logoSindserm: string;
  logoPleito: string | null;
}): Promise<LogoPair> {
  const [sindserm, pleitoLogo] = await Promise.all([
    fetchPngDataUrl(pleito.logoSindserm),
    pleito.logoPleito ? fetchPngDataUrl(pleito.logoPleito) : Promise.resolve(null),
  ]);
  return { sindserm, pleito: pleitoLogo };
}

const MARGIN_X = 48;

/**
 * Desenha o cabeçalho oficial (logos + títulos) e devolve o Y onde o CONTEÚDO
 * deve começar. O bloco de texto central usa uma largura SEGURA que nunca invade
 * as áreas das logos — corrige a sobreposição que quebrava o cabeçalho.
 */
function drawPdfHeader(
  doc: jsPDF,
  logos: LogoPair,
  opts: { titulo: string; subtitulo: string; geradoEm?: string },
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const topY = 42;
  const leftMaxW = 92;
  const leftMaxH = 42;
  const rightMax = 46;

  const drawLogo = (
    dataUrl: string,
    side: "left" | "right",
    maxW: number,
    maxH: number,
  ): number => {
    try {
      const props = doc.getImageProperties(dataUrl);
      const scale = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * scale;
      const h = props.height * scale;
      const x = side === "left" ? MARGIN_X : pageWidth - MARGIN_X - w;
      doc.addImage(dataUrl, x, topY, w, h);
      return topY + h;
    } catch {
      return topY;
    }
  };

  let leftBottom = topY;
  let rightBottom = topY;
  if (logos.sindserm) leftBottom = drawLogo(logos.sindserm, "left", leftMaxW, leftMaxH);
  if (logos.pleito) rightBottom = drawLogo(logos.pleito, "right", rightMax, rightMax);

  // Zona central segura (entre as logos), com folga de 12pt de cada lado.
  const safeLeft = MARGIN_X + leftMaxW + 12;
  const safeRight = pageWidth - MARGIN_X - rightMax - 12;
  const centerX = (safeLeft + safeRight) / 2;
  const safeW = safeRight - safeLeft;

  let ty = topY + 13;
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("SEV SINDSERM", centerX, ty, { align: "center" });
  ty += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  for (const ln of doc.splitTextToSize(opts.subtitulo, safeW) as string[]) {
    doc.text(ln, centerX, ty, { align: "center" });
    ty += 11;
  }
  doc.setTextColor(20);
  for (const ln of doc.splitTextToSize(opts.titulo, safeW) as string[]) {
    doc.text(ln, centerX, ty, { align: "center" });
    ty += 11;
  }
  if (opts.geradoEm) {
    doc.setFontSize(8.5);
    doc.setTextColor(120);
    doc.text(opts.geradoEm, centerX, ty, { align: "center" });
    doc.setTextColor(20);
    ty += 11;
  }

  // O conteúdo começa abaixo do mais baixo entre texto e logos.
  const y = Math.max(ty, leftBottom, rightBottom) + 14;
  doc.setDrawColor(210);
  doc.line(MARGIN_X, y, pageWidth - MARGIN_X, y);
  return y + 22;
}

/** Kit de desenho com cursor `y` compartilhado (evita repetir helpers). */
function pdfToolkit(doc: jsPDF, startY: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottom = pageHeight - 48;
  const larguraUtil = pageWidth - MARGIN_X * 2;
  const s = { y: startY };

  const ensureSpace = (need: number) => {
    if (s.y + need > bottom) {
      doc.addPage();
      s.y = 56;
    }
  };
  const tituloSecao = (t: string, cor: [number, number, number]) => {
    ensureSpace(34);
    doc.setFillColor(cor[0], cor[1], cor[2]);
    doc.roundedRect(MARGIN_X, s.y - 12, larguraUtil, 22, 4, 4, "F");
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(t, MARGIN_X + 10, s.y + 3);
    doc.setTextColor(20);
    s.y += 28;
  };
  const linha = (label: string, valor: string) => {
    ensureSpace(16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text(label, MARGIN_X + 4, s.y);
    doc.setFont("helvetica", "bold");
    doc.text(valor, pageWidth - MARGIN_X - 4, s.y, { align: "right" });
    s.y += 15;
  };
  const paragrafo = (t: string, size = 9.5, cor = 70) => {
    for (const ln of doc.splitTextToSize(t, larguraUtil - 8) as string[]) {
      ensureSpace(13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(size);
      doc.setTextColor(cor);
      doc.text(ln, MARGIN_X + 4, s.y);
      s.y += 12;
    }
    doc.setTextColor(20);
    s.y += 4;
  };
  const barra = (label: string, valor: number, max: number) => {
    ensureSpace(24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text((doc.splitTextToSize(label, larguraUtil - 70) as string[])[0], MARGIN_X + 4, s.y);
    doc.setFont("helvetica", "bold");
    doc.text(String(valor), pageWidth - MARGIN_X - 4, s.y, { align: "right" });
    s.y += 4;
    const w = max > 0 ? Math.max(2, (valor / max) * larguraUtil) : 0;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(MARGIN_X + 4, s.y, larguraUtil - 8, 5, 2, 2, "F");
    doc.setFillColor(16, 122, 76);
    doc.roundedRect(MARGIN_X + 4, s.y, Math.min(larguraUtil - 8, w), 5, 2, 2, "F");
    s.y += 14;
  };
  // Caixa de destaque (verde = ok, vermelho = alerta) para a reconciliação.
  const callout = (ok: boolean, titulo: string, texto: string) => {
    const linhas = doc.splitTextToSize(texto, larguraUtil - 24) as string[];
    const altura = 30 + linhas.length * 11;
    ensureSpace(altura + 6);
    if (ok) {
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(16, 122, 76);
    } else {
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(190, 40, 40);
    }
    doc.roundedRect(MARGIN_X, s.y, larguraUtil, altura, 6, 6, "FD");
    let iy = s.y + 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(ok ? 16 : 150, ok ? 100 : 30, ok ? 64 : 30);
    doc.text(titulo, MARGIN_X + 12, iy);
    iy += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(60);
    for (const ln of linhas) {
      doc.text(ln, MARGIN_X + 12, iy);
      iy += 11;
    }
    doc.setTextColor(20);
    s.y += altura + 12;
  };

  return { pageWidth, bottom, larguraUtil, s, ensureSpace, tituloSecao, linha, paragrafo, barra, callout };
}

type PdfKit = ReturnType<typeof pdfToolkit>;

/**
 * Bloco compacto "como é apurado + garantias + LGPD" — deixa o documento
 * AUTOEXPLICATIVO: quem lê entende por que o resultado é confiável e sob quais
 * regras/lei foi produzido. Sem muralha jurídica.
 */
function blocoGarantiasLgpd(kit: PdfKit) {
  kit.tituloSecao("COMO É APURADO E POR QUE É CONFIÁVEL", [100, 116, 139]);
  kit.paragrafo(
    "Voto secreto: o sistema não guarda nenhuma ligação entre o voto e quem votou, nem o horário do voto. É impossível saber em quem alguém votou.",
  );
  kit.paragrafo(
    "Uma pessoa, um voto: CPF e matrícula são únicos por eleição e por rodada; a segunda tentativa é recusada pelo sistema.",
  );
  kit.paragrafo(
    "Apuração automática: o nº de vagas de cada local segue uma regra pública (progressão pelo nº de candidatos); os mais votados ocupam as vagas; quem renuncia dá lugar ao suplente; empate na linha de corte aguarda desempate pelo estatuto/assembleia.",
  );
  kit.paragrafo(
    "Reconciliação: o total de votos apurados confere com o total de votantes (comparecimento) — divergência seria anomalia auditável.",
  );
  kit.paragrafo(
    "Trilha pública: cada passo oficial (agendamento, encerramento, suplementar, renúncia) fica registrado na linha do tempo do local, no Portal da Transparência.",
  );
  kit.paragrafo(
    "Privacidade (LGPD — Lei nº 13.709/2018): este documento traz apenas dados de interesse coletivo (nomes de candidatos, votos e participação agregada), necessários à transparência e à fiscalização do processo. Dados pessoais dos votantes (CPF, matrícula, telefone, e-mail) não são divulgados e são tratados exclusivamente para impedir voto em duplicidade.",
  );
}

/**
 * Rodapé institucional/legal — natureza do documento, onde auditar (URL do
 * portal), fundamento e canal de contestação. Fecha qualquer relatório.
 */
function rodapeInstitucional(
  doc: jsPDF,
  kit: PdfKit,
  opts: { emailOficial?: string | null },
) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const geradoEm = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const canal = opts.emailOficial || "a diretoria do SINDSERM";

  kit.s.y += 6;
  kit.ensureSpace(20);
  doc.setDrawColor(210);
  doc.line(MARGIN_X, kit.s.y, kit.pageWidth - MARGIN_X, kit.s.y);
  kit.s.y += 12;

  const txt =
    `Documento gerado eletronicamente pelo SEV SINDSERM em ${geradoEm}. ` +
    `Confira e audite os mesmos dados, a qualquer momento, no Portal da Transparência` +
    `${origin ? `: ${origin}` : " do SINDSERM"}. ` +
    `O processo segue o estatuto/regimento eleitoral do SINDSERM, por voto direto e secreto. ` +
    `Este relatório reflete os dados públicos no momento da geração e não substitui a ata oficial ` +
    `homologada pela comissão eleitoral. Dúvidas ou contestação: ${canal}.`;

  for (const ln of doc.splitTextToSize(txt, kit.larguraUtil) as string[]) {
    kit.ensureSpace(11);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(ln, MARGIN_X, kit.s.y);
    kit.s.y += 10;
  }
  doc.setTextColor(20);
}

/**
 * PDF público de Eleitos e Suplentes de UM local. Cabeçalho oficial, dados do
 * local (com a rodada quando é suplementar) e as listas com os votos.
 */
export async function downloadResultadoPdf(
  resultado: ResultadoLocal,
  pleito: PdfPleito,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const logos = await loadLogos(pleito);
  const startY = drawPdfHeader(doc, logos, {
    titulo: pleito.titulo,
    subtitulo: "Portal da Transparência · Resultado do Local",
  });
  const kit = pdfToolkit(doc, startY);
  const { pageWidth, s } = kit;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(doc.splitTextToSize(resultado.nome, pageWidth - MARGIN_X * 2), MARGIN_X, s.y);
  s.y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${resultado.orgao} · Zona ${resultado.zona}`, MARGIN_X, s.y);
  s.y += 14;
  const encerramento = resultado.dataFim
    ? `Encerrada em ${formatData(resultado.dataFim)}`
    : "Votação ainda não agendada";
  const rodadaTxt =
    resultado.rodadaAtual > 1 ? ` · ${resultado.rodadaAtual}ª rodada (suplementar)` : "";
  doc.text(
    `${encerramento} · ${resultado.vagas} vaga(s) · ${resultado.totalVotantes} votante(s) · ${resultado.totalCandidatos} candidato(s)${rodadaTxt}`,
    MARGIN_X,
    s.y,
  );
  doc.setTextColor(20);
  s.y += 22;

  const secao = (
    titulo: string,
    itens: { nome: string; votos: number; preservado?: boolean }[],
    cor: [number, number, number],
  ) => {
    kit.tituloSecao(`${titulo} (${itens.length})`, cor);
    if (itens.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(120);
      kit.ensureSpace(16);
      doc.text("Nenhum.", MARGIN_X + 4, s.y);
      doc.setTextColor(20);
      s.y += 18;
      return;
    }
    doc.setFontSize(10.5);
    itens.forEach((c, i) => {
      kit.ensureSpace(16);
      doc.setFont("helvetica", "normal");
      const sufixo = c.preservado ? "  (eleito na rodada anterior)" : "";
      doc.text(
        (doc.splitTextToSize(`${i + 1}. ${c.nome}${sufixo}`, kit.larguraUtil - 80) as string[])[0],
        MARGIN_X + 4,
        s.y,
      );
      doc.setFont("helvetica", "bold");
      doc.text(`${c.votos} voto(s)`, pageWidth - MARGIN_X - 4, s.y, { align: "right" });
      s.y += 16;
    });
    s.y += 8;
  };

  secao("ELEITOS (TITULARES)", resultado.eleitos, [16, 122, 76]);

  // Empate na linha de corte (aguardando desempate) — transparência pública.
  if (resultado.empate) {
    kit.tituloSecao(
      `EMPATE NA LINHA DE CORTE — ${resultado.empate.vagasEmDisputa} vaga(s) em disputa`,
      [180, 83, 9],
    );
    kit.paragrafo(
      `${resultado.empate.candidatos.length} candidato(s) empatados com ${resultado.empate.votos} voto(s), ` +
        `aguardando desempate pelo estatuto/assembleia: ${resultado.empate.candidatos.join(", ")}.`,
      10,
      40,
    );
  }

  secao("SUPLENTES", resultado.suplentes, [100, 116, 139]);

  if (resultado.semVotos > 0) {
    kit.ensureSpace(16);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(120);
    doc.text(`+ ${resultado.semVotos} candidato(s) sem votos.`, MARGIN_X + 4, s.y);
    doc.setTextColor(20);
    s.y += 8;
  }

  blocoGarantiasLgpd(kit);
  rodapeInstitucional(doc, kit, { emailOficial: pleito.emailOficial });

  doc.save(
    `eleitos-${resultado.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}.pdf`,
  );
}

/**
 * PDF de uma RODADA ARQUIVADA (histórico): o resultado oficial de uma rodada que
 * já foi encerrada e superada por uma nova (ex.: a 1ª rodada, depois que se abriu
 * a suplementar/nova eleição). Gerado a partir do snapshot público — permite
 * baixar e guardar o resultado daquela rodada, detalhado, para auditoria.
 */
export async function downloadRodadaPdf(
  data: { localNome: string; orgao: string; zona: string; rodada: RodadaArquivada },
  pleito: PdfPleito,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const logos = await loadLogos(pleito);
  const startY = drawPdfHeader(doc, logos, {
    titulo: pleito.titulo,
    subtitulo: `Portal da Transparência · Resultado da ${data.rodada.rodada}ª rodada (arquivado)`,
  });
  const kit = pdfToolkit(doc, startY);
  const { pageWidth, s } = kit;
  const r = data.rodada;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(doc.splitTextToSize(data.localNome, pageWidth - MARGIN_X * 2), MARGIN_X, s.y);
  s.y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`${data.orgao} · Zona ${data.zona}`, MARGIN_X, s.y);
  s.y += 14;
  doc.text(
    `${r.rodada}ª rodada · encerrada em ${formatData(r.encerradaEm)} · ${r.vagas} vaga(s) · ${r.votantes} votante(s)`,
    MARGIN_X,
    s.y,
  );
  doc.setTextColor(20);
  s.y += 22;

  // Reconciliação daquela rodada (prova de que os números batiam).
  kit.callout(
    r.confere,
    r.confere ? "Números conferem — rodada reconciliada" : "Atenção: números não batem",
    r.confere
      ? `${nf(r.votantes)} pessoas votaram e foram registrados ${nf(r.votos)} votos nesta rodada. Como cada pessoa vota uma vez por rodada, os totais batem.`
      : `${nf(r.votantes)} votantes x ${nf(r.votos)} votos: houve divergência nesta rodada.`,
  );

  kit.tituloSecao(`ELEITOS DA ${r.rodada}ª RODADA (${r.eleitos.length})`, [16, 122, 76]);
  if (r.eleitos.length === 0) {
    kit.paragrafo("Nenhum eleito nesta rodada.");
  } else {
    doc.setFontSize(10.5);
    r.eleitos.forEach((c, i) => {
      kit.ensureSpace(16);
      doc.setFont("helvetica", "normal");
      const sufixo = c.preservado ? "  (eleito em rodada anterior)" : "";
      doc.text(
        (doc.splitTextToSize(`${i + 1}. ${c.nome}${sufixo}`, kit.larguraUtil - 80) as string[])[0],
        MARGIN_X + 4,
        s.y,
      );
      doc.setFont("helvetica", "bold");
      doc.text(`${c.votos} voto(s)`, pageWidth - MARGIN_X - 4, s.y, { align: "right" });
      s.y += 16;
    });
  }

  blocoGarantiasLgpd(kit);
  rodapeInstitucional(doc, kit, { emailOficial: pleito.emailOficial });

  const slug = data.localNome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  doc.save(`rodada-${r.rodada}-${slug}.pdf`);
}

/* -------------------------------------------------------------------------- */
/*                  Relatório PERSONALIZADO (o filiado escolhe)               */
/* -------------------------------------------------------------------------- */

export type SecoesRelatorio = {
  resumo: boolean;
  integridade: boolean;
  zona: boolean;
  orgao: boolean;
  eleitos: boolean;
  metodologia: boolean;
};

/**
 * PDF PERSONALIZADO do filiado: renderiza APENAS as seções escolhidas, na ordem
 * resumo → integridade → participação (zona/órgão) → eleitos → metodologia/LGPD.
 * Só dados públicos (sem PII). Cabeçalho oficial com as logos do pleito.
 */
export async function downloadRelatorioPersonalizado(
  data: RelatorioTransparencia,
  secoes: SecoesRelatorio,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const logos = await loadLogos(data.pleito);
  const startY = drawPdfHeader(doc, logos, {
    titulo: data.pleito.titulo,
    subtitulo: "Portal da Transparência · Relatório do Filiado",
    geradoEm: `Gerado em ${data.geradoEm} · dados públicos e auditáveis`,
  });
  const kit = pdfToolkit(doc, startY);
  const { pageWidth, s } = kit;

  if (secoes.resumo) {
    kit.tituloSecao("RESUMO DO PLEITO", [30, 41, 59]);
    kit.linha("Locais de votação", nf(data.kpis.locais));
    kit.linha("Total de votantes (comparecimento)", nf(data.kpis.votantes));
    kit.linha("Vagas no pleito", nf(data.kpis.vagas));
    kit.linha("Eleitos definidos", nf(data.kpis.eleitos));
    kit.linha("Votações em andamento", nf(data.kpis.abertas));
    kit.linha("Votações encerradas", nf(data.kpis.encerradas));
    if (data.kpis.suplementares > 0) {
      kit.linha("Locais em eleição suplementar", nf(data.kpis.suplementares));
    }
    s.y += 6;
  }

  if (secoes.integridade) {
    kit.tituloSecao("INTEGRIDADE (RECONCILIAÇÃO)", [16, 122, 76]);
    kit.callout(
      data.integridade.confere,
      data.integridade.confere
        ? "Os números conferem"
        : "Atenção: os números não conferem",
      data.integridade.confere
        ? `${nf(data.integridade.votantes)} pessoas votaram e ${nf(data.integridade.votos)} votos foram ` +
            `registrados. Cada pessoa vota uma vez por rodada — nenhuma divergência encontrada.`
        : `${nf(data.integridade.votantes)} votantes x ${nf(data.integridade.votos)} votos: recomenda-se investigação/contestação.`,
    );
  }

  if (secoes.zona && data.porZona.length > 0) {
    kit.tituloSecao("PARTICIPAÇÃO POR ZONA", [37, 99, 235]);
    const max = Math.max(...data.porZona.map((z) => z.votantes), 1);
    for (const z of data.porZona) kit.barra(z.zona, z.votantes, max);
    s.y += 6;
  }

  if (secoes.orgao && data.porOrgao.length > 0) {
    kit.tituloSecao("PARTICIPAÇÃO POR ÓRGÃO", [37, 99, 235]);
    const max = Math.max(...data.porOrgao.map((o) => o.votantes), 1);
    for (const o of data.porOrgao.slice(0, 40)) kit.barra(o.orgao, o.votantes, max);
    s.y += 6;
  }

  if (secoes.eleitos) {
    kit.tituloSecao("ELEITOS POR LOCAL (ENCERRADOS)", [16, 122, 76]);
    if (data.eleitos.length === 0) {
      kit.paragrafo("Nenhum eleito consolidado ainda.");
    } else {
      let localAtual = "";
      for (const r of data.eleitos) {
        if (r.local !== localAtual) {
          localAtual = r.local;
          kit.ensureSpace(18);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text(
            (doc.splitTextToSize(`${r.local} — ${r.orgao} · Zona ${r.zona}`, kit.larguraUtil) as string[])[0],
            MARGIN_X + 2,
            s.y,
          );
          s.y += 14;
        }
        kit.ensureSpace(14);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`• ${r.eleito}`, MARGIN_X + 10, s.y);
        doc.setFont("helvetica", "bold");
        doc.text(`${r.votos} voto(s)`, pageWidth - MARGIN_X - 4, s.y, { align: "right" });
        s.y += 13;
      }
      s.y += 6;
    }
  }

  if (secoes.metodologia) {
    kit.tituloSecao("METODOLOGIA E PRIVACIDADE (LGPD)", [100, 116, 139]);
    kit.paragrafo(
      "Fundamento: eleição de representantes de base por voto direto e secreto, conforme o estatuto/regimento eleitoral do SINDSERM.",
    );
    kit.paragrafo(
      "Apuração: o número de vagas de cada local depende do total de candidatos (regra pública de progressão). Os mais votados ocupam as vagas; empate na linha de corte exige desempate pelo estatuto/assembleia; quem não assume dá lugar ao próximo suplente. Suplementar: nova rodada que preserva os já eleitos e disputa só as vagas restantes (ou recomeça do zero), com o resultado de cada rodada arquivado.",
    );
    kit.paragrafo(
      "Sigilo do voto: não há qualquer vínculo entre o voto e a pessoa que votou, nem registro de horário do voto — é impossível saber em quem alguém votou. Uma pessoa, um voto: CPF e matrícula são únicos por eleição e rodada. Reconciliação: o total de votos confere com o total de votantes.",
    );
    kit.paragrafo(
      "Privacidade (LGPD — Lei nº 13.709/2018): este relatório traz apenas dados de interesse coletivo (nomes de candidatos, votos e participação agregada), necessários à transparência e fiscalização. Dados pessoais dos votantes (CPF, matrícula, telefone, e-mail) NÃO são divulgados e servem somente para impedir voto em duplicidade.",
    );
    // Como contestar — o caminho prático para o filiado.
    kit.paragrafo(
      "Como contestar: qualquer filiado pode contestar um resultado. Reúna (1) o nome do local, " +
        "(2) o protocolo do seu comprovante de votação, se tiver, e (3) o que quer contestar, e envie ao canal oficial.",
    );
    kit.paragrafo(
      data.pleito.emailOficial
        ? `Canal oficial: ${data.pleito.emailOficial}`
        : "Canal oficial: procure a diretoria do SINDSERM.",
      9.5,
      20,
    );
  }

  rodapeInstitucional(doc, kit, { emailOficial: data.pleito.emailOficial });

  doc.save(`relatorio-transparencia-pleito-${data.pleito.ano}.pdf`);
}
