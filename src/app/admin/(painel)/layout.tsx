import {
  getCurrentElectionYear,
  getElectionsForSidebar,
  getSelectedElectionYear,
} from "@/lib/election";
import { Sidebar } from "@/components/admin/sidebar";
import { MobileNav } from "@/components/admin/mobile-nav";

export const dynamic = "force-dynamic";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A guarda de "primeiro acesso" (sem pleito) é feita por página via
  // requirePleito() — confiável em navegação client-side. O layout só monta a
  // sidebar (que, sem pleito, exibe o estado bloqueado).
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
        />
      </div>
      <main className="min-w-0 flex-1">
        {/* Navegação mobile (hambúrguer + gaveta) — só aparece abaixo de lg. */}
        <MobileNav
          elections={elections}
          currentElectionYear={anoVigente}
          selectedYear={anoSelecionado}
        />
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
