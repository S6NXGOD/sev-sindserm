import { ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

/**
 * Tela para usuário SEM acesso a nenhum módulo (todas as permissões em "Sem
 * acesso"). Não chama requireModule (evita loop). Orienta procurar o admin.
 */
export default async function SemAcessoPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h1 className="text-xl font-bold tracking-tight">Sem acesso liberado</h1>
      <p className="text-sm text-muted-foreground">
        Olá, {user.nome}. Sua conta ainda não tem permissão para nenhum módulo do
        sistema. Fale com o Administrador Geral para liberar seus acessos.
      </p>
    </div>
  );
}
