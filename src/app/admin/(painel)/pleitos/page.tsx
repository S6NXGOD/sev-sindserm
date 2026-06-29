import Link from "next/link";
import { Pencil, Plus, Vote } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  FALLBACK_LOGO_SINDSERM,
  getCurrentElectionYear,
  tituloInstitucional,
  trienioLabel,
} from "@/lib/election";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteElectionButton } from "@/components/admin/delete-election-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PleitosPage() {
  const anoVigente = getCurrentElectionYear();

  const [elections, locaisPorAno] = await Promise.all([
    prisma.election.findMany({ orderBy: { ano: "desc" } }),
    prisma.workplace.groupBy({
      by: ["anoEleicao"],
      _count: { anoEleicao: true },
    }),
  ]);

  const locaisMap = new Map(
    locaisPorAno.map((g) => [g.anoEleicao, g._count.anoEleicao]),
  );
  // Quantos pleitos por ano (para saber se os dados do ano são compartilhados).
  const pleitosPorAno = new Map<number, number>();
  for (const e of elections) {
    pleitosPorAno.set(e.ano, (pleitosPorAno.get(e.ano) ?? 0) + 1);
  }
  const vigenteCadastrado = elections.some((e) => e.ano === anoVigente);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Vote className="h-6 w-6" />
            Pleitos
          </h1>
          <p className="text-sm text-muted-foreground">
            Eleições cadastradas e suas logos. O pleito vigente é definido por{" "}
            <code>NEXT_PUBLIC_CURRENT_ELECTION_YEAR</code> ({anoVigente}).
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/pleitos/novo">
            <Plus className="mr-2 h-4 w-4" />
            Novo pleito
          </Link>
        </Button>
      </div>

      {!vigenteCadastrado && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <span className="text-amber-800">
              O pleito vigente <strong>{anoVigente}</strong> ainda não foi
              cadastrado (usando título e logos padrão).
            </span>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/pleitos/novo">Cadastrar pleito {anoVigente}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {elections.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum pleito cadastrado ainda. Crie o primeiro em “Novo pleito”.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {elections.map((e) => (
            <Card key={e.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">
                      Triênio {trienioLabel(e.ano, e.duracaoMandato)}
                    </CardTitle>
                    <CardDescription>
                      {tituloInstitucional(e.titulo, e.ano, e.duracaoMandato)}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {e.ano === anoVigente && (
                      <Badge variant="success">Vigente</Badge>
                    )}
                    <Badge
                      variant={e.status === "ATIVO" ? "secondary" : "outline"}
                    >
                      {e.status === "ATIVO"
                        ? "Ativo"
                        : e.status === "ENCERRADO"
                          ? "Encerrado"
                          : "Rascunho"}
                    </Badge>
                    {e.isEleicaoEspecial && (
                      <Badge variant="outline">Especial</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="space-y-1 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={e.logoSindsermUrl ?? FALLBACK_LOGO_SINDSERM}
                      alt="Logo SINDSERM"
                      className="h-12 w-auto max-w-[120px] object-contain"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      SINDSERM{" "}
                      {e.logoSindsermUrl ? "" : "(padrão)"}
                    </p>
                  </div>
                  <div className="space-y-1 text-center">
                    {e.logoPleitoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.logoPleitoUrl}
                        alt="Logo do pleito"
                        className="h-12 w-12 object-contain"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed text-[9px] text-muted-foreground">
                        sem logo
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">Pleito</p>
                  </div>
                  <div className="ml-auto text-right text-sm text-muted-foreground">
                    {locaisMap.get(e.ano) ?? 0} local(is)
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button asChild size="sm">
                    <Link href={`/admin/pleitos/${e.id}/editar`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar pleito
                    </Link>
                  </Button>
                  <DeleteElectionButton
                    electionId={e.id}
                    ano={e.ano}
                    trienio={trienioLabel(e.ano, e.duracaoMandato)}
                    locais={locaisMap.get(e.ano) ?? 0}
                    compartilhaAno={(pleitosPorAno.get(e.ano) ?? 0) > 1}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
