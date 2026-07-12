import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getCurrentElectionYear,
  getElectionEmail,
  getElectionLogos,
} from "@/lib/election";
import { formatDateTime } from "@/lib/format";
import { votingStatus } from "@/lib/voting-status";
import { VotingForm } from "@/components/voting-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { linkToken: string };
};

function ClosedScreen({
  titulo,
  mensagem,
  inicio,
  fim,
  logoPleito,
}: {
  titulo: string;
  mensagem: string;
  /** null = janela ainda não agendada — não exibe as linhas de início/fim. */
  inicio: Date | null;
  fim: Date | null;
  /** Logo do pleito; null = oculta graciosamente (sem fallback). */
  logoPleito: string | null;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          {/* Regra estrita: sem logo do pleito, não renderiza imagem quebrada. */}
          {logoPleito && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPleito}
              alt="Logo do pleito"
              width={72}
              height={72}
              className="mb-1 max-h-[72px] object-contain"
            />
          )}
          <div className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <CalendarClock className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">{titulo}</CardTitle>
          <CardDescription>{mensagem}</CardDescription>
        </CardHeader>
        {/* Sem janela agendada não há datas para mostrar — o card fica só com a
            mensagem, sem linhas vazias. */}
        {inicio && fim && (
          <CardContent className="space-y-1 text-sm text-slate-600">
            <p>
              <span className="font-medium">Início:</span>{" "}
              {formatDateTime(inicio)}
            </p>
            <p>
              <span className="font-medium">Encerramento:</span>{" "}
              {formatDateTime(fim)}
            </p>
          </CardContent>
        )}
      </Card>
    </main>
  );
}

export default async function VotacaoPage({ params }: PageProps) {
  // Apenas a eleição VIGENTE é servida publicamente (isolamento por ano).
  // Não carregamos a lista de candidatos aqui (pode ter milhares) — só a contagem.
  const workplace = await prisma.workplace.findFirst({
    where: {
      linkToken: params.linkToken,
      anoEleicao: getCurrentElectionYear(),
    },
    include: { _count: { select: { candidates: true } } },
  });

  if (!workplace) {
    notFound();
  }

  // Logos da eleição à qual este Workplace pertence (com fallback).
  const logos = await getElectionLogos(workplace.anoEleicao);
  const emailOficial = await getElectionEmail(workplace.anoEleicao);
  const agora = new Date();
  const inicio = workplace.dataInicioVotacao;
  const fim = workplace.dataFimVotacao;
  const status = votingStatus(inicio, fim, agora);

  // Local ainda SEM janela agendada: a urna não existe até a diretoria visitar.
  // Vem antes de qualquer outra checagem (nem candidatos importam aqui).
  // O `|| !inicio || !fim` é redundante em runtime, mas estreita o tipo para as
  // telas seguintes (Date | null -> Date).
  if (status === "undefined" || !inicio || !fim) {
    return (
      <ClosedScreen
        titulo="Votação ainda não agendada"
        mensagem="A votação para este local ainda não foi agendada. Aguarde a visita da diretoria do SINDSERM."
        inicio={null}
        fim={null}
        logoPleito={logos.pleito}
      />
    );
  }

  if (status === "upcoming") {
    return (
      <ClosedScreen
        titulo="Votação não iniciada"
        mensagem="O período de votação para este local ainda não começou."
        inicio={inicio}
        fim={fim}
        logoPleito={logos.pleito}
      />
    );
  }

  if (status === "closed") {
    return (
      <ClosedScreen
        titulo="Votação encerrada"
        mensagem="O período de votação para este local já foi encerrado."
        inicio={inicio}
        fim={fim}
        logoPleito={logos.pleito}
      />
    );
  }

  if (workplace._count.candidates === 0) {
    return (
      <ClosedScreen
        titulo="Votação indisponível"
        mensagem="Ainda não há candidatos cadastrados para este local."
        inicio={inicio}
        fim={fim}
        logoPleito={logos.pleito}
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* Regra estrita: logo do pleito só aparece se existir (sem fallback).
              Sem ela, o layout se adapta — o título sobe e fica centralizado. */}
          {logos.pleito && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logos.pleito}
              alt="Logo do pleito"
              width={96}
              height={96}
              className="h-24 w-24 object-contain"
            />
          )}
          <h1 className="mt-2 text-lg font-bold tracking-tight text-slate-800">
            Eleições Representantes de Base
          </h1>
          <p className="text-xs text-slate-500">
            SEV SINDSERM · Sistema Eletrônico de Votação do SINDSERM
          </p>
        </div>
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle className="text-xl">{workplace.nome}</CardTitle>
                <CardDescription>{workplace.orgao}</CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <Badge variant="secondary">Zona: {workplace.zona}</Badge>
              <Badge variant="outline">
                Votação aberta até {formatDateTime(fim)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="mb-6 text-sm text-slate-600">
              Preencha seus dados e selecione o candidato de sua preferência.
              Cada eleitor pode votar <strong>uma única vez</strong> (validado
              por CPF e Matrícula).
            </p>
            <VotingForm linkToken={workplace.linkToken} />
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-slate-400">
          Seu voto é sigiloso. Os dados pessoais informados não possuem qualquer
          vínculo com o voto computado.
        </p>
        {emailOficial && (
          <p className="mt-1 text-center text-xs text-slate-400">
            Dúvidas ou envio de atas:{" "}
            <a href={`mailto:${emailOficial}`} className="underline">
              {emailOficial}
            </a>
          </p>
        )}
        <div className="mt-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logos.sindserm}
            alt="Logo SINDSERM"
            className="h-auto max-h-16 w-auto max-w-[240px] object-contain opacity-90"
          />
        </div>
      </div>
    </main>
  );
}
