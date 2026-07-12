/**
 * STATUS DE VOTAÇÃO DE UM LOCAL — fonte ÚNICA da regra (usada na dashboard, no
 * painel do local, na listagem, nos relatórios, na transparência e na urna).
 *
 * Regra de negócio: o local NÃO herda mais as datas do pleito. Ele nasce sem
 * datas e a diretoria agenda a janela quando visita o local. Daí os 4 status:
 *
 *  • "undefined" — datas null. Aguardando a visita/agendamento da diretoria.
 *  • "upcoming"  — início no FUTURO. Já agendada, mas ainda não abriu.
 *  • "open"      — agora está entre início e fim. Votando.
 *  • "closed"    — fim no PASSADO. Encerrada.
 *
 * Os quatro são MUTUAMENTE EXCLUSIVOS: todo local cai em exatamente um.
 */
export type VotingStatus = "undefined" | "upcoming" | "open" | "closed";

/** Deriva o status a partir da janela (null/ausente = ainda não agendada). */
export function votingStatus(
  inicio: Date | null | undefined,
  fim: Date | null | undefined,
  now: Date = new Date(),
): VotingStatus {
  if (!inicio || !fim) return "undefined";
  if (now < inicio) return "upcoming";
  if (now > fim) return "closed";
  return "open";
}

/** true só quando a urna está de fato aberta (nunca para datas não definidas). */
export function isVotingOpen(
  inicio: Date | null | undefined,
  fim: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return votingStatus(inicio, fim, now) === "open";
}

/** Rótulos para a UI (com acento). */
export const VOTING_STATUS_LABEL: Record<VotingStatus, string> = {
  undefined: "Aguardando agendamento",
  upcoming: "Não iniciada",
  open: "Em andamento",
  closed: "Encerrada",
};

/** Rótulos ASCII para CSV/PDF (relatórios sem acento). */
export const VOTING_STATUS_ASCII: Record<VotingStatus, string> = {
  undefined: "Nao definida",
  upcoming: "Nao iniciada",
  open: "Em andamento",
  closed: "Encerrada",
};
