/**
 * Parser leve de CSV para importação de candidatos.
 * Espera UMA coluna com cabeçalho "nome" (o cabeçalho é opcional e ignorado).
 * Trata: BOM, quebras de linha \r\n / \r / \n, campos entre aspas e separador
 * "," ou ";". Remove só linhas vazias — MANTÉM homônimos (cada linha vira um
 * candidato distinto; nomes iguais NÃO são descartados).
 */

function primeiraColuna(linha: string): string {
  if (linha.startsWith('"')) {
    let res = "";
    let i = 1;
    while (i < linha.length) {
      const ch = linha[i];
      if (ch === '"') {
        // "" representa uma aspa literal dentro do campo
        if (linha[i + 1] === '"') {
          res += '"';
          i += 2;
          continue;
        }
        break;
      }
      res += ch;
      i++;
    }
    return res;
  }
  const sep = linha.search(/[,;]/);
  return sep === -1 ? linha : linha.slice(0, sep);
}

export function parseNomesCsv(content: string): string[] {
  const text = (content ?? "").replace(/^﻿/, ""); // remove BOM
  const linhas = text.split(/\r\n|\r|\n/);

  const nomes: string[] = [];
  let primeiraNaoVazia = true;

  for (const raw of linhas) {
    const linha = raw.trim();
    if (!linha) continue;

    const valor = primeiraColuna(linha).trim();

    // A primeira linha não vazia, se for "nome", é o cabeçalho — ignorada.
    if (primeiraNaoVazia) {
      primeiraNaoVazia = false;
      if (valor.toLowerCase() === "nome") continue;
    }

    if (!valor) continue;

    // NÃO deduplica: dois candidatos podem ter o MESMO nome (homônimos) — cada
    // linha é um candidato distinto. Descartar "duplicados" excluiria pessoas.
    nomes.push(valor.slice(0, 120));
  }

  return nomes;
}
