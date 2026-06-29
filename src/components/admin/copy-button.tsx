"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Copiar link",
  size = "sm",
}: {
  value: string;
  label?: string;
  size?: "sm" | "default" | "icon";
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Link copiado para a área de transferência.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={handleCopy}>
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {size !== "icon" && <span className="ml-2">{label}</span>}
    </Button>
  );
}
