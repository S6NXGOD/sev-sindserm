"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { changeMyPassword } from "@/lib/actions/auth";
import { initialActionState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <KeyRound className="mr-2 h-4 w-4" />
      )}
      Alterar senha
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useFormState(
    changeMyPassword,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      formRef.current?.reset();
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="senhaAtual">Senha atual *</Label>
        <Input
          id="senhaAtual"
          name="senhaAtual"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="novaSenha">Nova senha *</Label>
          <Input
            id="novaSenha"
            name="novaSenha"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
          />
          <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmarSenha">Confirmar nova senha *</Label>
          <Input
            id="confirmarSenha"
            name="confirmarSenha"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
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
