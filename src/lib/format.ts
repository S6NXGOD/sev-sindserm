const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateTimeFormatter.format(d);
}

/**
 * Contagem regressiva curta até uma data futura: "em 12 min", "em 5 h",
 * "em 3 dias". Usada nos cards de "Próximas aberturas". Calculada no servidor
 * (as telas são force-dynamic + auto-refresh), então não há risco de divergir
 * entre servidor e cliente na hidratação.
 */
export function tempoAte(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = d.getTime() - now.getTime();
  if (ms <= 0) return "agora";

  const min = Math.floor(ms / 60_000);
  if (min < 1) return "em instantes";
  if (min < 60) return `em ${min} min`;

  const horas = Math.floor(min / 60);
  if (horas < 24) return `em ${horas} h`;

  const dias = Math.floor(horas / 24);
  return `em ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/**
 * Converte uma Date para o formato de <input type="datetime-local">
 * (YYYY-MM-DDTHH:mm) no fuso de BRASÍLIA (America/Sao_Paulo) — consistente com o
 * parse (que interpreta o input como UTC-3) e com a exibição (formatDateTime).
 * NÃO usa getHours()/getFullYear(), que dependeriam do fuso do servidor (UTC).
 */
export function toDateTimeLocalValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}
