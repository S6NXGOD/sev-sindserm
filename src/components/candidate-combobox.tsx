"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { searchCandidates, type CandidateOption } from "@/lib/actions/votacao";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Autocomplete assíncrono de candidatos (Command + Popover).
 * Busca no servidor (no máx. 20 por vez) — nunca carrega a lista inteira.
 */
export function CandidateCombobox({
  linkToken,
  value,
  onChange,
}: {
  linkToken: string;
  value: CandidateOption | null;
  onChange: (candidate: CandidateOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<CandidateOption[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const meuId = ++reqId.current;
    setLoading(true);
    // debounce de 250ms para a digitação
    const t = setTimeout(async () => {
      try {
        const res = await searchCandidates(linkToken, search);
        if (meuId === reqId.current) setOptions(res);
      } catch {
        if (meuId === reqId.current) setOptions([]);
      } finally {
        if (meuId === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, search, linkToken]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
          )}
        >
          {value ? value.nome : "Busque e selecione o candidato"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite o nome do candidato..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            )}
            {!loading && (
              <>
                <CommandEmpty>Nenhum candidato encontrado.</CommandEmpty>
                <CommandGroup>
                  {options.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => {
                        onChange(c);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value?.id === c.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {c.nome}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {options.length === 20 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    Mostrando os 20 primeiros. Refine a busca para ver mais.
                  </p>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
