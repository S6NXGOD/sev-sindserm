import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCurrentElectionYear } from "@/lib/election";
import { requireModule } from "@/lib/current-user";
import { listGalleryImages } from "@/lib/system-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateElectionForm } from "@/components/admin/create-election-form";

export const dynamic = "force-dynamic";

export default async function NovoPleitoPage() {
  await requireModule("pleitos", "EDIT");
  const images = await listGalleryImages();
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
          <CardTitle className="text-2xl">Novo Pleito</CardTitle>
          <CardDescription>
            Cadastre um novo pleito (eleição) com título, ano de referência e,
            opcionalmente, as logos do SINDSERM e do pleito.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateElectionForm
            anoSugerido={getCurrentElectionYear()}
            images={images}
          />
        </CardContent>
      </Card>
    </div>
  );
}
