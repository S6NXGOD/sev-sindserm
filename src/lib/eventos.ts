import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// SERVER-ONLY. Escrita da LINHA DO TEMPO pública de cada local (append-only).
// Aceita o client normal OU um client de transação (para gravar junto do ato).

type DbClient = typeof prisma | Prisma.TransactionClient;

/** Snapshot público do resultado de UMA rodada encerrada (sem PII). */
export type RodadaSnapshot = {
  vagas: number;
  votantes: number;
  votos: number;
  confere: boolean;
  eleitos: { nome: string; votos: number; preservado?: boolean }[];
};

export type TipoEvento =
  | "AGENDAMENTO"
  | "ENCERRAMENTO"
  | "REABERTURA"
  | "SUPLEMENTAR"
  | "RENUNCIA"
  | "RODADA_ENCERRADA"
  | "DISPENSA";

type EventoInput = {
  workplaceId: string;
  anoEleicao: number;
  rodada: number;
  tipo: TipoEvento;
  titulo: string;
  detalhe?: string | null;
  autorNome?: string | null;
  snapshot?: RodadaSnapshot | null;
};

export async function registrarEventoLocal(
  client: DbClient,
  data: EventoInput,
): Promise<void> {
  await client.localEvento.create({
    data: {
      workplaceId: data.workplaceId,
      anoEleicao: data.anoEleicao,
      rodada: data.rodada,
      tipo: data.tipo,
      titulo: data.titulo,
      detalhe: data.detalhe ?? null,
      autorNome: data.autorNome ?? null,
      // Prisma Json aceita objeto direto; null explícito quando não há snapshot.
      snapshot: data.snapshot
        ? (data.snapshot as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  });
}

/**
 * Versão BEST-EFFORT: a linha do tempo é secundária e NUNCA pode quebrar uma
 * ação crítica (encerrar/agendar/reabrir/renúncia). Falha aqui só é logada.
 */
export async function registrarEventoLocalSafe(
  client: DbClient,
  data: EventoInput,
): Promise<void> {
  try {
    await registrarEventoLocal(client, data);
  } catch (error) {
    console.error("Falha ao registrar evento da linha do tempo:", error);
  }
}
