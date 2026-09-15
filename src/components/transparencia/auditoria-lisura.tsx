"use client";

import { useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  FileSearch,
  Lock,
  Mail,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
} from "lucide-react";

/**
 * "Auditoria, Integridade e Lisura" — DISCRETO por padrão: uma barra enxuta com
 * o selo de reconciliação (a prova anti-fraude) sempre visível; o restante
 * (garantias, como auditar, como contestar, LGPD) abre ao clicar. Não rouba a
 * cena do resultado, mas está a um toque de distância. Mobile-first.
 */
export function AuditoriaLisura({
  integridade,
  emailOficial,
  tituloPleito,
}: {
  integridade: { votantes: number; votos: number; confere: boolean };
  emailOficial: string | null;
  tituloPleito: string;
}) {
  const [aberto, setAberto] = useState(false);
  const nf = (n: number) => n.toLocaleString("pt-BR");
  const ok = integridade.confere;

  const mailto = emailOficial
    ? `mailto:${emailOficial}?subject=${encodeURIComponent(
        `Contestação de resultado — ${tituloPleito}`,
      )}&body=${encodeURIComponent(
        "Olá, quero contestar/esclarecer um resultado.\n\n" +
          "• Local de votação: \n" +
          "• Protocolo do meu comprovante (se tiver): \n" +
          "• O que quero contestar/verificar: \n\n" +
          "Obrigado(a).",
      )}`
    : null;

  const garantias = [
    {
      Icon: Lock,
      titulo: "Voto secreto de verdade",
      texto:
        "O voto não guarda data/hora nem qualquer ligação com quem votou. É impossível descobrir em quem alguém votou.",
    },
    {
      Icon: UserCheck,
      titulo: "Uma pessoa, um voto",
      texto:
        "CPF e matrícula são únicos por eleição: ninguém vota duas vezes. O sistema recusa a segunda tentativa.",
    },
    {
      Icon: BadgeCheck,
      titulo: "Apuração automática",
      texto:
        "Os eleitos saem de uma regra pública de vagas aplicada pelo computador — sem ninguém digitar resultado à mão.",
    },
    {
      Icon: ScrollText,
      titulo: "Tudo registrado",
      texto:
        "Quem agendou, abriu e encerrou cada votação fica gravado numa auditoria interna, com data e responsável.",
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      {/* Barra enxuta (sempre visível) — clique para abrir/fechar. */}
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
      >
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-tight sm:text-base">
            Auditoria, integridade e lisura
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Como conferir os números e o que fazer se algo parecer errado.
          </p>
        </div>
        {/* Selo de integridade — o sinal de confiança que fica sempre à vista. */}
        <span
          className={`hidden shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex ${
            ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {ok ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <TriangleAlert className="h-3.5 w-3.5" />
          )}
          {ok ? "Urna conferida" : "Verificar números"}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
            aberto ? "rotate-180" : ""
          }`}
        />
      </button>

      {aberto && (
        <div className="space-y-5 border-t p-4 sm:p-5">
          {/* Reconciliação (anti-fraude): comparecimento x votos na urna. */}
          <div
            className={`rounded-xl border-2 p-4 ${
              ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
            }`}
          >
            <div className="flex items-start gap-3">
              {ok ? (
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
              ) : (
                <TriangleAlert className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
              )}
              <div className="min-w-0">
                <p className={`font-bold ${ok ? "text-emerald-900" : "text-rose-900"}`}>
                  {ok
                    ? "Números conferem — urna reconciliada"
                    : "Atenção: números não batem"}
                </p>
                <p className="mt-0.5 text-sm text-slate-700">
                  <strong>{nf(integridade.votantes)}</strong> pessoas compareceram e
                  registraram <strong>{nf(integridade.votos)}</strong> voto(s).
                  {ok
                    ? " Cada pessoa vota exatamente uma vez — e os dois números batem, como deve ser."
                    : " Uma divergência aqui indica anomalia e deve ser investigada."}
                </p>
              </div>
            </div>
          </div>

          {/* Garantias do sistema (humanizado, em cartões). */}
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">
              Como garantimos que é limpa
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {garantias.map((g) => (
                <div
                  key={g.titulo}
                  className="flex gap-3 rounded-xl border bg-slate-50/60 p-3"
                >
                  <g.Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{g.titulo}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {g.texto}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Como VOCÊ audita + como contesta. */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <FileSearch className="h-4 w-4 text-primary" />
                Como você mesmo pode conferir
              </p>
              <ol className="ml-4 list-decimal space-y-1 text-xs leading-relaxed text-muted-foreground">
                <li>Veja a participação e os eleitos de cada local aqui embaixo.</li>
                <li>Baixe o Relatório Geral (CSV ou PDF) e guarde uma cópia.</li>
                <li>Confira que o total de votos bate com o de votantes (acima).</li>
                <li>Compare com o que você viu na sua urna/local no dia.</li>
              </ol>
            </div>
            <div className="rounded-xl border p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Mail className="h-4 w-4 text-primary" />
                Encontrou algo estranho? Conteste
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Qualquer filiado pode contestar um resultado. Reúna o local, o
                protocolo do seu comprovante e o motivo, e envie à diretoria pelo
                canal oficial.
              </p>
              {mailto ? (
                <a
                  href={mailto}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Abrir contestação por e-mail
                </a>
              ) : (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Fale com a diretoria do SINDSERM para registrar sua contestação.
                </p>
              )}
            </div>
          </div>

          {/* LGPD: o que é público e o que é protegido. */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-sky-900">
              <ShieldCheck className="h-4 w-4" />
              Privacidade e LGPD
            </p>
            <div className="grid gap-3 text-xs leading-relaxed sm:grid-cols-2">
              <div>
                <p className="font-semibold text-emerald-800">
                  Público (de interesse coletivo)
                </p>
                <p className="text-muted-foreground">
                  Nome dos candidatos, votos apurados, eleitos/suplentes e a
                  participação por local/zona. São o resultado da eleição — precisam
                  ser públicos para você poder auditar.
                </p>
              </div>
              <div>
                <p className="font-semibold text-rose-800">Protegido (nunca exposto)</p>
                <p className="text-muted-foreground">
                  CPF, matrícula, telefone, e-mail e — acima de tudo — em quem cada
                  pessoa votou. Servem só para evitar voto duplicado e nunca aparecem
                  aqui.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
