export type ActionState = {
  // "warning": operação concluída COM ressalva (ex.: datas alteradas, mas o
  // pleito já tem votos). O cliente trata como sucesso, mas com toast de atenção.
  status: "idle" | "success" | "error" | "warning";
  message: string;
};

export const initialActionState: ActionState = {
  status: "idle",
  message: "",
};

/** Dados do comprovante de votação, retornados pela action de voto. */
export type VoteReceipt = {
  protocolo: string;
  nome: string;
  cpfMascarado: string;
  matricula: string;
  local: string;
  orgao: string;
  zona: string;
  dataHora: string;
  // Logos para o cabeçalho do comprovante (regra estrita):
  /** Logo do SINDSERM (já resolvida com o DEFAULT_LOGO como fallback). */
  logoSindsermUrl: string;
  /** Logo do pleito (do banco). null = não exibir (sem fallback). */
  logoPleitoUrl: string | null;
};

export type VoteActionState = ActionState & {
  receipt?: VoteReceipt;
};

export const initialVoteActionState: VoteActionState = {
  status: "idle",
  message: "",
};
