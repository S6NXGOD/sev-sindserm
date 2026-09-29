import { FileText, ExternalLink, FolderOpen } from "lucide-react";
import { formatarTamanho, type DocumentoView } from "@/lib/documentos-constants";

/**
 * Lista PÚBLICA de documentos oficiais do pleito (atas, editais, resultados),
 * para fiscalização e auditoria. Fica na aba "Regras & Auditoria" do portal.
 * Componente de servidor: apenas renderiza links — o PDF é servido pela rota
 * /api/uploads/[...file]. Paleta calma (o vermelho fica só no ícone do PDF).
 */
export function DocumentosOficiais({
  documentos,
}: {
  documentos: DocumentoView[];
}) {
  return (
    <section
      data-tour="documentos"
      className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="mb-1 flex items-center gap-2">
        <div className="shrink-0 rounded-lg bg-slate-100 p-2 text-slate-600">
          <FolderOpen className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold">Documentos oficiais</h3>
      </div>
      <p className="mb-4 text-xs leading-tight text-muted-foreground">
        Atas, editais e resultados publicados pela Diretoria para transparência e
        fiscalização. Clique para abrir o PDF.
      </p>

      {documentos.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhum documento oficial publicado ainda. Assim que a Diretoria
          publicar atas e editais, eles aparecem aqui.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border">
          {documentos.map((d) => (
            <li key={d.id}>
              <a
                href={d.arquivoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 transition hover:bg-slate-50"
              >
                <FileText className="h-5 w-5 shrink-0 text-red-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {d.titulo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.categoria} · {formatarTamanho(d.tamanho)} ·{" "}
                    {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
