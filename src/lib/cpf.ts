/**
 * Utilitários de CPF.
 * normalizeCpf: mantém apenas dígitos (garante unicidade consistente no banco).
 * isValidCpf: valida os dígitos verificadores do CPF.
 */

export function normalizeCpf(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export function formatCpf(value: string): string {
  const d = normalizeCpf(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Mascara o CPF para o comprovante, preservando só os 3 primeiros e 2 últimos dígitos. */
export function maskCpf(value: string): string {
  const d = normalizeCpf(value).padStart(11, "0").slice(0, 11);
  return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`;
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);

  if (cpf.length !== 11) return false;
  // Rejeita sequências repetidas (000..., 111..., etc.)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);

  const calcCheckDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += digits[i] * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return (
    calcCheckDigit(9) === digits[9] && calcCheckDigit(10) === digits[10]
  );
}
