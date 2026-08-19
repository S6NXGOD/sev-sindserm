"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Plus,
  ScrollText,
  Settings,
  Shield,
  Trophy,
  Users,
  Vote,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";
import type { SidebarElection } from "@/lib/election";
import {
  pode,
  rotuloPerfil,
  type Modulo,
  type SessionUser,
} from "@/lib/permissions";
import { Avatar } from "@/components/admin/avatar";
import { DEFAULT_LOGO } from "@/lib/logo-constants";
import { PLEITO_COOKIE, PLEITO_COOKIE_MAX_AGE } from "@/lib/pleito-cookie";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NAV: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  modulo: Modulo;
}[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, modulo: "dashboard" },
  { href: "/admin/locais", label: "Locais de Trabalho", icon: Building2, modulo: "locais" },
  { href: "/admin/encerradas", label: "Encerradas & Eleitos", icon: Trophy, modulo: "encerradas" },
  { href: "/admin/votantes", label: "Votantes", icon: Users, modulo: "votantes" },
  { href: "/admin/relatorios", label: "Relatórios", icon: FileText, modulo: "relatorios" },
  { href: "/admin/pleitos", label: "Pleitos", icon: Vote, modulo: "pleitos" },
  { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText, modulo: "auditoria" },
  { href: "/admin/usuarios", label: "Usuários", icon: Shield, modulo: "usuarios" },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings, modulo: "configuracoes" },
];

export function Sidebar({
  elections,
  currentElectionYear,
  selectedYear,
  user,
}: {
  elections: SidebarElection[];
  currentElectionYear: number;
  /** Ano resolvido pelo cookie no servidor (seleção persistente). */
  selectedYear: number;
  /** Usuário logado — filtra a navegação por permissão e mostra nome/papel. */
  user: SessionUser;
}) {
  const pathname = usePathname();
  // Só mostra os módulos que o usuário pode ao menos visualizar.
  const navItems = NAV.filter((i) => pode(user.permissoes, i.modulo, "VIEW"));
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Precedência: ?ano= explícito (deep-link/auditoria) > cookie (selectedYear).
  const anoUrl = Number(searchParams.get("ano"));
  const anoInicial =
    Number.isInteger(anoUrl) && elections.some((e) => e.ano === anoUrl)
      ? anoUrl
      : selectedYear;
  const [ano, setAno] = useState(anoInicial);

  // Mantém o seletor em sincronia com a URL/cookie (navegação entre páginas).
  useEffect(() => {
    setAno(anoInicial);
  }, [anoInicial]);

  const pleito =
    elections.find((e) => e.ano === ano) ?? elections[0] ?? null;
  const semPleito = elections.length === 0;

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function trocarPleito(value: string) {
    setAno(Number(value)); // troca as logos imediatamente (otimista)
    // Persiste a escolha: todos os módulos passam a mostrar este pleito sem
    // precisar trocar a cada navegação.
    document.cookie = `${PLEITO_COOKIE}=${value}; path=/; max-age=${PLEITO_COOKIE_MAX_AGE}; samesite=lax`;
    // Vai para o caminho atual SEM querystring (limpa ?ano/page) e revalida os
    // dados do servidor com o novo cookie.
    startTransition(() => {
      router.push(pathname);
      router.refresh();
    });
  }

  // ESTADO BLOQUEADO (primeiro acesso): nenhum pleito cadastrado.
  // Não exibe pleito "fantasma"; trava os módulos e só libera criar o pleito.
  if (semPleito) {
    return (
      <aside className="flex h-full w-64 flex-col border-r bg-white">
        <div className="space-y-3 border-b p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={DEFAULT_LOGO}
            alt="SEV SINDSERM"
            className="mx-auto h-16 w-16 object-contain"
          />
          <div className="leading-tight">
            <p className="font-bold tracking-tight">SEV SINDSERM</p>
            <p className="text-[11px] text-muted-foreground">
              Sistema Eletrônico de Votação do SINDSERM
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-4 p-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Nenhum pleito cadastrado. Crie o primeiro pleito para liberar os
            módulos do sistema.
          </div>
          <Button asChild className="w-full">
            <Link href="/admin/pleitos/novo">
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro pleito
            </Link>
          </Button>

          {/* Módulos bloqueados (visual) até existir um pleito. */}
          <nav className="space-y-1 pt-1">
            {navItems
              .filter((i) => i.href !== "/admin/pleitos")
              .map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.href}
                  aria-disabled
                  title="Crie o primeiro pleito para acessar"
                  className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  <Lock className="ml-auto h-3.5 w-3.5" />
                </div>
              );
            })}
          </nav>
        </div>

        <div className="border-t p-3">
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start text-slate-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </form>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white">
      <div className="space-y-3 border-b p-4">
        {/* Logo do PLEITO no topo (dinâmica). Sem logo do pleito → oculta. */}
        {pleito?.logoPleito && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pleito.logoPleito}
              alt="Logo do pleito"
              className="h-16 w-16 object-contain"
            />
          </div>
        )}

        <div className="text-center leading-tight">
          <p className="font-bold tracking-tight">SEV SINDSERM</p>
          <p className="text-[11px] text-muted-foreground">
            Sistema Eletrônico de Votação do SINDSERM
          </p>
        </div>

        {/* Seletor de pleito — cada item com a miniatura da logo do pleito */}
        <div className="space-y-1">
          <Label className="text-[11px] uppercase text-muted-foreground">
            Pleito
          </Label>
          <Select value={String(ano)} onValueChange={trocarPleito}>
            <SelectTrigger className="h-9" disabled={isPending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {elections.map((e) => (
                <SelectItem key={e.ano} value={String(e.ano)}>
                  <span className="flex items-center gap-2">
                    {e.logoPleito && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.logoPleito}
                        alt=""
                        className="h-4 w-4 shrink-0 object-contain"
                      />
                    )}
                    Triênio {e.trienio}
                    {e.ano === currentElectionYear ? " (vigente)" : ""}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t p-3">
        {/* Usuário logado — clique abre o perfil (nome + foto). */}
        <Link
          href="/admin/perfil"
          className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 transition hover:bg-slate-100"
        >
          <Avatar nome={user.nome} fotoUrl={user.fotoUrl} size={36} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{user.nome}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {rotuloPerfil(user.permissoes)}
            </p>
          </div>
        </Link>
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start text-slate-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </form>
        {/* Logo do SINDSERM embaixo (dinâmica) */}
        <div className="flex justify-center pt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pleito?.logoSindserm}
            alt="Logo SINDSERM"
            className="max-h-12 w-auto max-w-[180px] object-contain opacity-90"
          />
        </div>
      </div>
    </aside>
  );
}
