import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/admin/login-form";
import { getLoginLogoUrl } from "@/lib/system-settings";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const r = searchParams.redirect;
  const redirectTo =
    r && r.startsWith("/admin") && r !== "/admin/login" ? r : "/admin";

  // Logo da tela de login vinda das Configurações Globais (Singleton).
  // getLoginLogoUrl() já aplica o FALLBACK ESTRITO: se não houver logo
  // configurada, devolve a logo padrão — nunca uma string vazia.
  const loginLogoUrl = await getLoginLogoUrl();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-6">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="items-center space-y-3 text-center">
            {/* Logo configurável (Configurações Globais) com fallback estrito.
                Dentro de um "medalhão" para dar respiro e destacar melhor. */}
            <div className="flex h-36 w-36 items-center justify-center rounded-full border bg-white shadow-sm ring-1 ring-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={loginLogoUrl}
                alt="SEV SINDSERM"
                width={128}
                height={128}
                className="h-28 w-28 object-contain"
              />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl">SEV SINDSERM</CardTitle>
              <CardDescription>
                Sistema Eletrônico de Votação do SINDSERM
              </CardDescription>
            </div>
            <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Painel Administrativo
            </p>
          </CardHeader>
          <CardContent>
            <LoginForm redirectTo={redirectTo} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
