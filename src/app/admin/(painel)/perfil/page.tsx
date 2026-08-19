import { KeyRound, UserCircle } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { rotuloPerfil } from "@/lib/permissions";
import { ProfileForm } from "@/components/admin/profile-form";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** Perfil do PRÓPRIO usuário — foto, nome e troca de senha. Sem restrição de módulo. */
export default async function PerfilPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <UserCircle className="h-6 w-6 text-primary" />
          Meu perfil
        </h1>
        <p className="text-sm text-muted-foreground">
          Atualize sua foto e seu nome de exibição.{" "}
          <Badge variant="outline" className="ml-1 align-middle">
            {rotuloPerfil(user.permissoes)}
          </Badge>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do perfil</CardTitle>
          <CardDescription>
            A foto aparece no menu, na barra lateral e na lista de usuários.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            nome={user.nome}
            username={user.username}
            fotoUrl={user.fotoUrl}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-5 w-5" />
            Trocar minha senha
          </CardTitle>
          <CardDescription>
            Ao trocar, suas outras sessões (outros aparelhos) são encerradas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
