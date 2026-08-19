import { CalendarClock, Lock, Plus } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { Avatar } from "@/components/admin/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type Ator = {
  nome: string | null;
  fotoUrl: string | null;
  em: Date | null;
};

/**
 * "Quem fez o quê" direto no local: foto + nome + horário de quem CRIOU,
 * AGENDOU e ENCERROU. Some as linhas sem autor. O histórico completo (todas as
 * ações, inclusive candidatos) fica no módulo Auditoria.
 */
export function RegistroLocal({
  criado,
  agendado,
  encerrado,
}: {
  criado?: Ator;
  agendado?: Ator;
  encerrado?: Ator;
}) {
  const linhas = [
    criado?.nome
      ? { label: "Criado por", ...criado, Icon: Plus, cor: "text-emerald-600" }
      : null,
    agendado?.nome
      ? { label: "Agendado por", ...agendado, Icon: CalendarClock, cor: "text-primary" }
      : null,
    encerrado?.nome
      ? { label: "Encerrado por", ...encerrado, Icon: Lock, cor: "text-amber-600" }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    nome: string | null;
    fotoUrl: string | null;
    em: Date | null;
    Icon: typeof Plus;
    cor: string;
  }>;

  if (linhas.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-muted-foreground">
          Registro de ações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {linhas.map((l) => (
          <div key={l.label} className="flex items-center gap-3">
            <Avatar nome={l.nome ?? "?"} fotoUrl={l.fotoUrl} size={32} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm">
                <l.Icon className={`h-3.5 w-3.5 shrink-0 ${l.cor}`} />
                <span className="text-muted-foreground">{l.label}</span>
                <span className="truncate font-semibold">{l.nome}</span>
              </p>
              {l.em && (
                <p className="pl-5 text-xs text-muted-foreground">
                  {formatDateTime(l.em)}
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
