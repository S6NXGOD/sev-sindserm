"use client";

import { useState } from "react";
import {
  ChevronDown,
  Gavel,
  Layers,
  Lock,
  ScrollText,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

/**
 * "Base legal e conformidade" — bloco DISCRETO (recolhível) que fundamenta a
 * eleição: base legal (CF/CLT/Estatuto/Regimento), princípios eleitorais REAIS
 * do sistema e a hierarquia das regras. Complementa a "Auditoria, integridade e
 * lisura" (que trata das garantias técnicas). Só afirma o que o sistema de fato
 * faz — sem invocar Justiça Eleitoral/TSE (é processo sindical privado).
 */
export function ConformidadeLegal() {
  const [aberto, setAberto] = useState(false);

  const baseLegal = [
    {
      Icon: Gavel,
      titulo: "Constituição Federal (Art. 8º)",
      texto:
        "Garante a autonomia e a liberdade de organização sindical e a representação dos trabalhadores.",
    },
    {
      Icon: ScrollText,
      titulo: "CLT — Consolidação das Leis do Trabalho",
      texto:
        "Ampara o direito de associação e de representação de base da categoria.",
    },
    {
      Icon: Layers,
      titulo: "Estatuto do SINDSERM e deliberações do V CONSERM",
      texto:
        "Legitimam a criação do Conselho de Representantes de Base e das suas vagas.",
    },
    {
      Icon: ScrollText,
      titulo: "Regimento Eleitoral vigente",
      texto:
        "Define quem vota e concorre, o cálculo de vagas, os prazos, a votação e a apuração.",
    },
  ];

  const principios = [
    {
      Icon: Lock,
      titulo: "Voto secreto",
      texto:
        "Não há vínculo entre o voto e o eleitor, e o voto não tem carimbo de horário. Registra-se apenas o comparecimento (quem votou), jamais em quem — é impossível identificar o voto de alguém.",
    },
    {
      Icon: UserCheck,
      titulo: "Voto único",
      texto:
        "CPF e matrícula são únicos por eleição e por rodada; a segunda tentativa é recusada pelo sistema.",
    },
    {
      Icon: ShieldCheck,
      titulo: "Integridade da urna",
      texto:
        "Os votos são computados e reconciliados: o total de votos confere com o total de votantes. Qualquer divergência é detectável.",
    },
    {
      Icon: ScrollText,
      titulo: "Auditabilidade",
      texto:
        "Dados públicos, linha do tempo de cada local e relatórios para conferência pela comissão eleitoral e por qualquer filiado.",
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
      >
        <Gavel className="h-5 w-5 shrink-0 text-slate-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold tracking-tight sm:text-base">
            Base legal e conformidade
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Sob quais leis e regras esta eleição se ampara.
          </p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:inline">
          Estatuto + Regimento
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
            aberto ? "rotate-180" : ""
          }`}
        />
      </button>

      {aberto && (
        <div className="space-y-5 border-t p-4 sm:p-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">
              Base legal (fundamentação)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {baseLegal.map((b) => (
                <div key={b.titulo} className="flex gap-3 rounded-xl border bg-slate-50/60 p-3">
                  <b.Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{b.titulo}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {b.texto}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <a
              href="/doc/regimento_eleicao.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <ScrollText className="h-3.5 w-3.5" />
              Baixar o Regimento da Eleição
            </a>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">
              Princípios eleitorais adotados
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {principios.map((p) => (
                <div key={p.titulo} className="flex gap-3 rounded-xl border bg-slate-50/60 p-3">
                  <p.Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{p.titulo}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {p.texto}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Layers className="h-4 w-4" />
              Hierarquia das regras
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong>Estatuto do SINDSERM</strong> (e deliberações do V CONSERM) →{" "}
              <strong>Regimento Eleitoral vigente</strong> →{" "}
              <strong>decisões da Diretoria Colegiada</strong> para os casos
              omissos (Art. 24 do Regimento; ex.: desempate). As decisões são
              registradas em ata.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Trata-se de eleição interna e privada da entidade sindical, por voto
              direto e secreto — não é conduzida pela Justiça Eleitoral.
            </p>
          </div>

          {/* Disposição a auditoria oficial — mediante solicitação formal e LGPD. */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
              <ShieldCheck className="h-4 w-4" />
              Aberto à auditoria oficial
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Caso a comissão eleitoral, um órgão competente ou uma auditoria
              independente contratada precise examinar o pleito, a entidade
              disponibiliza — mediante solicitação formal pelos canais oficiais e
              observada a LGPD — os registros técnicos necessários (contagens,
              logs e a trilha de auditoria). O objetivo é permitir a conferência
              por profissionais habilitados, com respaldo legal.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
