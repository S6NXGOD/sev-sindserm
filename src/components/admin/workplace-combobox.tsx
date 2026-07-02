"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  searchWorkplacesLite,
  type WorkplaceOption,
} from "@/lib/actions/admin";
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
 * Autocomplete de LOCAIS para os filtros (Votantes/Relatórios). Busca no
 * servidor (searchWorkplacesLite) limitando os resultados — nunca carrega a
 * lista inteira. `valueLabel` é o nome do local já selecionado (resolvido no
 * servidor a partir da URL) para exibição imediata.
 */
export function WorkplaceCombobox({
  ano,
  value,
  valueLabel,
  onSelect,
  placeholder = "Todos os locais",
  clearLabel = "Todos os locais",
}: {
  ano: number;
  value: string;
  valueLabel: string;
  onSelect: (value: string, label: string) => void;
  placeholder?: string;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<WorkplaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const meu = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchWorkplacesLite(ano, query);
        if (meu === reqId.current) setOptions(res);
      } catch {
        if (meu === reqId.current) setOptions([]);
      } finally {
        if (meu === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, query, ano]);

  function pick(v: string, label: string) {
    onSelect(v, label);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
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
          <span className="truncate">{value ? valueLabel : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar local..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandItem value="__clear__" onSelect={() => pick("", "")}>
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  value === "" ? "opacity-100" : "opacity-0",
                )}
              />
              {clearLabel}
            </CommandItem>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            ) : options.length === 0 ? (
              <CommandEmpty>Nenhum local encontrado.</CommandEmpty>
            ) : (
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={o.id}
                    onSelect={() => pick(o.id, o.nome)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === o.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{o.nome}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
