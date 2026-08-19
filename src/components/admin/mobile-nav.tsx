"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import type { SidebarElection } from "@/lib/election";
import type { SessionUser } from "@/lib/permissions";
import { DEFAULT_LOGO } from "@/lib/logo-constants";
import { Sidebar } from "@/components/admin/sidebar";
import { AdminHeaderMobileActions } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";

/**
 * Navegação MOBILE/TABLET (< lg): barra superior com botão hambúrguer que abre
 * uma gaveta (drawer) à esquerda contendo a MESMA <Sidebar> do desktop —
 * garantindo paridade total (seletor de pleito, links, logout, estado bloqueado).
 *
 * Tudo aqui é `lg:hidden`. No desktop (lg+) este componente some e a sidebar
 * fixa assume, preservando 100% a experiência atual — nada muda em telas grandes.
 */
export function MobileNav({
  elections,
  currentElectionYear,
  selectedYear,
  user,
}: {
  elections: SidebarElection[];
  currentElectionYear: number;
  selectedYear: number;
  user: SessionUser;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Fecha a gaveta automaticamente ao navegar para outra página.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {/* Barra superior — só aparece no mobile/tablet. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden print:hidden">
        <Dialog.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Abrir menu de navegação"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </Dialog.Trigger>
        <div className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={DEFAULT_LOGO}
            alt=""
            className="h-7 w-7 shrink-0 object-contain"
          />
          <span className="truncate text-sm font-bold tracking-tight">
            SEV SINDSERM
          </span>
        </div>
        {/* Sino de notificações + menu do usuário à direita. */}
        <div className="ml-auto">
          <AdminHeaderMobileActions user={user} />
        </div>
      </div>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden"
        >
          <Dialog.Title className="sr-only">Menu de navegação</Dialog.Title>
          {/* Botão fechar com alvo de toque confortável. */}
          <Dialog.Close
            aria-label="Fechar menu"
            className="absolute right-2 top-2 z-10 rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </Dialog.Close>
          <Sidebar
            elections={elections}
            currentElectionYear={currentElectionYear}
            selectedYear={selectedYear}
            user={user}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
