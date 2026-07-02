"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeForSearch } from "@/lib/slug";
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

export type ComboOption = { value: string; label: string };

/**
 * Combo-box de seleção com BUSCA (autocomplete client-side) sobre uma lista já
 * conhecida — ideal para conjuntos pequenos (ex.: órgãos). Opcionalmente:
 *  - `creatable`: permite CADASTRAR um valor novo digitando (texto livre);
 *  - `clearLabel`: adiciona uma opção para limpar a seleção (value = "").
 * Busca acento- e caixa-insensível.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyLabel = "Nenhum resultado.",
  creatable = false,
  clearLabel,
  disabled = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  creatable?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? (value || placeholder);

  const termo = normalizeForSearch(query);
  const filtered = termo
    ? options.filter((o) => normalizeForSearch(o.label).includes(termo))
    : options;
  const exactExists = options.some(
    (o) => normalizeForSearch(o.label) === termo,
  );
  const podeCriar = creatable && query.trim().length > 0 && !exactExists;

  function pick(v: string) {
    onChange(v);
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
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{display}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {clearLabel && (
              <CommandItem value="__clear__" onSelect={() => pick("")}>
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "" ? "opacity-100" : "opacity-0",
                  )}
                />
                {clearLabel}
              </CommandItem>
            )}
            {filtered.length === 0 && !podeCriar && (
              <CommandEmpty>{emptyLabel}</CommandEmpty>
            )}
            <CommandGroup>
              {filtered.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={() => pick(o.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === o.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {podeCriar && (
              <CommandGroup>
                <CommandItem
                  value="__create__"
                  onSelect={() => pick(query.trim())}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar “{query.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
