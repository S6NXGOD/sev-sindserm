import {
  getCurrentElectionYear,
  getElectionsForSidebar,
  getSelectedElectionYear,
} from "@/lib/election";
import { requireUser } from "@/lib/current-user";
import { Sidebar } from "@/components/admin/sidebar";
import { MobileNav } from "@/components/admin/mobile-nav";
import { NotificationsPrompt } from "@/components/pwa/notifications";

export const dynamic = "force-dynamic";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // GATE FINO: exige um usuário logado, ATIVO e com a versão de sessão vigente.
  // (O middleware só valida a assinatura do token — a checagem no banco é aqui.)
  // Sem usuário válido → redireciona para /login. Assim, ao migrar para a gestão
  // de usuários, todas as sessões antigas caem e cada um reloga com sua senha.
  const user = await requireUser();

  // A guarda de "primeiro acesso" (sem pleito) é feita por página via
  // requirePleito(). O layout monta a sidebar (que, sem pleito, exibe o estado
  // bloqueado) e o cabeçalho com o usuário/papel.
  const elections = await getElectionsForSidebar();
  const anoVigente = getCurrentElectionYear();
  const anoSelecionado = getSelectedElectionYear();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block print:!hidden">
        <Sidebar
          elections={elections}
          currentElectionYear={anoVigente}
          selectedYear={anoSelecionado}
          user={user}
        />
      </div>
      <main className="min-w-0 flex-1">
        {/* Navegação mobile (hambúrguer + gaveta) — só aparece abaixo de lg. */}
        <MobileNav
          elections={elections}
          currentElectionYear={anoVigente}
          selectedYear={anoSelecionado}
          user={user}
        />
        <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6 lg:p-8">
          {/* Prompt de notificações (aparece no 1º acesso; some ao ativar/dispensar). */}
          <NotificationsPrompt />
          {children}
        </div>
      </main>
    </div>
  );
}
