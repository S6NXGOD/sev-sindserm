import { cn } from "@/lib/utils";

/** Iniciais do nome (até 2 letras) para o fallback do avatar. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/**
 * Avatar do usuário: mostra a foto (data URL) quando existe, senão as iniciais.
 * Server-safe (sem "use client"). `size` em px (default 40).
 */
export function Avatar({
  nome,
  fotoUrl,
  size = 40,
  className,
}: {
  nome: string;
  fotoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const dim = { width: size, height: size };
  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoUrl}
        alt={nome}
        style={dim}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      style={dim}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary",
        className,
      )}
    >
      <span style={{ fontSize: Math.max(11, size * 0.38) }}>{iniciais(nome)}</span>
    </div>
  );
}
