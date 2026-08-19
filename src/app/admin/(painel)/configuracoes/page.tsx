import { Settings, ImageIcon, LogIn, ShieldCheck } from "lucide-react";
import {
  getCurrentElectionYear,
  getElectionLogos,
  getSelectedElectionYear,
  requirePleito,
  trienioLabel,
} from "@/lib/election";
import {
  getLoginLogoSetting,
  getLoginLogoUrl,
  listGalleryImages,
} from "@/lib/system-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoUploadForm } from "@/components/admin/logo-upload-form";
import { LoginLogoManager } from "@/components/admin/login-logo-manager";
import { ChangePasswordForm } from "@/components/admin/change-password-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: { ano?: string };
}) {
  await requirePleito();
  const ano = getSelectedElectionYear(searchParams.ano);
  const anoVigente = getCurrentElectionYear();
  const logos = await getElectionLogos(ano);

  // Configurações GLOBAIS (independentes do pleito): logo da tela de login.
  const [loginLogoUrl, loginLogoRaw, galleryImages] = await Promise.all([
    getLoginLogoUrl(),
    getLoginLogoSetting(),
    listGalleryImages(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Settings className="h-6 w-6" />
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground">
          Logos do pleito — <strong>Triênio {trienioLabel(ano)}</strong>
          {ano !== anoVigente ? " (histórico)" : " (vigente)"}. As imagens são
          isoladas por pleito: o envio de um ano nunca substitui as de outro.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-5 w-5" />
                Logos da eleição {ano}
              </CardTitle>
              <CardDescription>
                Use o seletor de pleito na barra lateral para configurar outro
                ano. Enquanto não houver upload, são usadas logos genéricas
                padrão.
              </CardDescription>
            </div>
            <Badge variant="outline">Pleito {ano}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <LogoUploadForm
            ano={ano}
            tipo="sindserm"
            label="Logo do SINDSERM"
            currentUrl={logos.sindserm}
            images={galleryImages}
          />
          <LogoUploadForm
            ano={ano}
            tipo="pleito"
            label="Logo do Pleito (Eleição)"
            currentUrl={logos.pleito}
            images={galleryImages}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogIn className="h-5 w-5" />
            Logo da Tela de Login
          </CardTitle>
          <CardDescription>
            Configuração <strong>global</strong> do sistema (não vinculada a
            nenhum pleito). Use a Galeria de Mídia para escolher uma imagem já
            enviada ou subir uma nova.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginLogoManager
            images={galleryImages}
            displayUrl={loginLogoUrl}
            isCustom={loginLogoRaw !== null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5" />
            Segurança — Minha senha
          </CardTitle>
          <CardDescription>
            Altere a SUA senha (a deste usuário). Confirme a senha atual e defina
            a nova. Suas outras sessões serão encerradas por segurança.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
