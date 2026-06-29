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
          <CardHeader className="items-center space-y-2 text-center">
            {/* Logo configurável (Configurações Globais) com fallback estrito. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={loginLogoUrl}
              alt="SEV SINDSERM"
              width={208}
              height={208}
              className="h-52 w-52 object-contain"
            />
            <CardTitle className="text-2xl">SEV SINDSERM</CardTitle>
            <CardDescription>
              Sistema Eletrônico de Votação do SINDSERM
            </CardDescription>
            <p className="pt-1 text-sm font-medium text-slate-700">
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
