"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2, Lock } from "lucide-react";
import { login } from "@/lib/actions/auth";
import { initialActionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Entrando...
        </>
      ) : (
        "Entrar"
      )}
    </Button>
  );
}

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useFormState(login, initialActionState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="redirect" value={redirectTo} />
      <div className="space-y-2">
        <Label htmlFor="password">Senha de administrador</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            className="pl-9"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            autoFocus
          />
        </div>
      </div>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
