"use client";

import Link from "next/link";
import { ChevronDown, LogOut, UserCircle } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { rotuloPerfil, type SessionUser } from "@/lib/permissions";
import { Avatar } from "@/components/admin/avatar";
import { NotificationsBell } from "@/components/pwa/notifications";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Menu do usuário: avatar + nome → perfil e sair. Compacto, reutilizável. */
function UserMenu({ user, showName }: { user: SessionUser; showName?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition hover:bg-slate-100">
          <Avatar nome={user.nome} fotoUrl={user.fotoUrl} size={34} />
          {showName && (
            <span className="hidden max-w-[140px] truncate text-sm font-semibold sm:inline">
              {user.nome}
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-0">
        <div className="flex items-center gap-3 border-b p-3">
          <Avatar nome={user.nome} fotoUrl={user.fotoUrl} size={40} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{user.nome}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {rotuloPerfil(user.permissoes)}
            </p>
          </div>
        </div>
        <div className="p-1.5">
          <Link
            href="/admin/perfil"
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <UserCircle className="h-4 w-4" />
            Meu perfil
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Cabeçalho DESKTOP (lg+): sino de notificações + menu do usuário à direita. */
export function AdminHeader({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 hidden items-center justify-end gap-1 border-b bg-white/95 px-6 py-2.5 backdrop-blur lg:flex print:hidden">
      <NotificationsBell />
      <UserMenu user={user} showName />
    </header>
  );
}

/** Ações compactas para a barra MOBILE (sino + avatar). */
export function AdminHeaderMobileActions({ user }: { user: SessionUser }) {
  return (
    <div className="flex items-center gap-1">
      <NotificationsBell />
      <UserMenu user={user} />
    </div>
  );
}
