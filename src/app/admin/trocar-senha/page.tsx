import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * Troca OBRIGATÓRIA de senha no 1º acesso (ou após reset pelo admin). Fica FORA
 * do grupo (painel) para não herdar o layout que redireciona para cá — evitando
 * loop. Quem não precisa trocar é mandado direto para o painel.
 */
export default async function TrocarSenhaPage() {
  const user = await requireUser();
  if (!user.mustChangePassword) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            <KeyRound className="h-5 w-5" />
            Defina sua nova senha
          </CardTitle>
          <CardDescription>
            Olá, <strong>{user.nome}</strong>. Por segurança, no primeiro acesso
            você precisa trocar a senha inicial antes de usar o sistema. Informe a
            senha atual (a que você recebeu) e crie uma nova.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm redirectOnSuccess="/admin" />
        </CardContent>
      </Card>
    </div>
  );
}
