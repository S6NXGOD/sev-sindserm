import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ImageIcon, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LOGO, trienioLabel } from "@/lib/election";
import { listGalleryImages } from "@/lib/system-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  EditElectionForm,
  type EditElectionData,
} from "@/components/admin/edit-election-form";
import { ElectionLogoManager } from "@/components/admin/election-logo-manager";

export const dynamic = "force-dynamic";

/** Date -> valor do input datetime-local ("YYYY-MM-DDTHH:mm"), em hora local. */
function toDatetimeLocalValue(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default async function EditarPleitoPage({
  params,
}: {
  params: { id: string };
}) {
  const election = await prisma.election.findUnique({
    where: { id: params.id },
  });
  if (!election) notFound();

  const [votos, galleryImages] = await Promise.all([
    prisma.vote.count({ where: { anoEleicao: election.ano } }),
    listGalleryImages(),
  ]);

  const data: EditElectionData = {
    id: election.id,
    ano: election.ano,
    titulo: election.titulo ?? "",
    duracaoMandato: election.duracaoMandato,
    status: election.status,
    isEleicaoEspecial: election.isEleicaoEspecial,
    emailOficial: election.emailOficial ?? "",
    dataInicioGeral: toDatetimeLocalValue(election.dataInicioGeral),
    dataFimGeral: toDatetimeLocalValue(election.dataFimGeral),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/pleitos">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Voltar para os pleitos
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-2xl">
                Editar pleito — Triênio{" "}
                {trienioLabel(election.ano, election.duracaoMandato)}
              </CardTitle>
              <CardDescription>
                Altere os dados do pleito. As logos são gerenciadas abaixo pela
                Galeria de Mídia.
              </CardDescription>
            </div>
            {election.isEleicaoEspecial && (
              <Badge variant="secondary">Especial/Suplementar</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {votos > 0 && (
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Este pleito já possui <strong>{votos}</strong> voto(s)
                registrado(s). Alterar as datas é permitido, mas não afeta os
                votos já computados — você receberá um aviso ao salvar.
              </p>
            </div>
          )}
          <EditElectionForm election={data} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-5 w-5" />
            Logos do pleito — Galeria de Mídia
          </CardTitle>
          <CardDescription>
            Escolha uma imagem da galeria (ou envie uma nova) para cada logo. As
            imagens ficam isoladas por pleito.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ElectionLogoManager
            electionId={election.id}
            tipo="sindserm"
            label="Logo do SINDSERM"
            currentUrl={election.logoSindsermUrl}
            placeholderUrl={DEFAULT_LOGO}
            images={galleryImages}
            allowClear={false}
            recomendacao="Recomendado: ~600×180 px (horizontal), PNG com fundo transparente. Sem logo, usa a padrão do sistema."
          />
          <ElectionLogoManager
            electionId={election.id}
            tipo="pleito"
            label="Logo do Pleito (Eleição)"
            currentUrl={election.logoPleitoUrl}
            placeholderUrl={DEFAULT_LOGO}
            images={galleryImages}
            allowClear
            recomendacao="Recomendado: ~400×400 px (quadrada), PNG com fundo transparente."
          />
        </CardContent>
      </Card>
    </div>
  );
}
