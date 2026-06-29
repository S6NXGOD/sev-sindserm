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
 * Converte uma Date para o formato aceito por <input type="datetime-local">
 * (YYYY-MM-DDTHH:mm), preservando o horário local do servidor.
 */
export function toDateTimeLocalValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
