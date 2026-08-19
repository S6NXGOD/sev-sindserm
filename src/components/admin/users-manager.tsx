"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Power,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  createUser,
  deleteUser,
  deslogarTodos,
  resetUserPassword,
  setUserAtivo,
  updateUser,
} from "@/lib/actions/users";
import { initialActionState } from "@/lib/types";
import {
  ROLE_DESC,
  ROLE_LABEL,
  ROLES_ATRIBUIVEIS,
  type Role,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type UserRow = {
  id: string;
  nome: string;
  username: string;
  role: Role;
  ativo: boolean;
  createdAt: string;
};

const ROLE_BADGE: Record<Role, string> = {
  SUPER_ADMIN: "border-rose-300 bg-rose-50 text-rose-700",
  ADMIN: "border-primary/30 bg-primary/10 text-primary",
  OPERADOR: "border-sky-300 bg-sky-50 text-sky-700",
  AUDITOR: "border-slate-300 bg-slate-100 text-slate-600",
};

function PendingButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} disabled={pending || props.disabled}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}

/** Select de papel + descrição do que ele pode. Reutilizado em criar/editar. */
function RoleSelect({
  value,
  onChange,
}: {
  value: Role;
  onChange: (r: Role) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Papel</Label>
      <Select value={value} onValueChange={(v) => onChange(v as Role)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES_ATRIBUIVEIS.map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABEL[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{ROLE_DESC[value]}</p>
    </div>
  );
}

function NovoUsuarioDialog() {
  const [state, formAction] = useFormState(createUser, initialActionState);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("OPERADOR");

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setOpen(false);
      setRole("OPERADOR");
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar usuário</DialogTitle>
          <DialogDescription>
            Cada pessoa tem seu login e senha próprios — para auditar quem faz o
            quê no sistema.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="role" value={role} />
          <div className="space-y-1.5">
            <Label htmlFor="nu-nome">Nome de exibição</Label>
            <Input id="nu-nome" name="nome" placeholder="Ex.: Maria Diretora" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu-user">Usuário (login)</Label>
            <Input
              id="nu-user"
              name="username"
              placeholder="ex.: maria.diretora"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <p className="text-xs text-muted-foreground">
              Minúsculas, números e . _ - (3 a 30 caracteres).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu-senha">Senha inicial</Label>
            <Input
              id="nu-senha"
              name="senha"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <RoleSelect value={role} onChange={setRole} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <PendingButton type="submit">
              <Plus className="mr-2 h-4 w-4" />
              Criar
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarUsuarioDialog({ user }: { user: UserRow }) {
  const [state, formAction] = useFormState(updateUser, initialActionState);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [nome, setNome] = useState(user.nome);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setOpen(false);
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Editar">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar {user.nome}</DialogTitle>
          <DialogDescription>@{user.username}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={user.id} />
          <input type="hidden" name="role" value={role} />
          <div className="space-y-1.5">
            <Label htmlFor={`ed-nome-${user.id}`}>Nome de exibição</Label>
            <Input
              id={`ed-nome-${user.id}`}
              name="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <RoleSelect value={role} onChange={setRole} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <PendingButton type="submit">Salvar</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetSenhaDialog({ user }: { user: UserRow }) {
  const [state, formAction] = useFormState(resetUserPassword, initialActionState);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      setOpen(false);
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Redefinir senha">
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha de {user.nome}</DialogTitle>
          <DialogDescription>
            Define uma nova senha. O usuário será deslogado e precisará entrar de
            novo com ela.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={user.id} />
          <div className="space-y-1.5">
            <Label htmlFor={`rs-${user.id}`}>Nova senha</Label>
            <Input
              id={`rs-${user.id}`}
              name="senha"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <PendingButton type="submit">Redefinir</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AtivarToggle({ user }: { user: UserRow }) {
  const [state, formAction] = useFormState(setUserAtivo, initialActionState);
  useEffect(() => {
    if (state.status === "success") toast.success(state.message);
    else if (state.status === "error") toast.error(state.message);
  }, [state]);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={user.id} />
      <input type="hidden" name="ativo" value={user.ativo ? "false" : "true"} />
      <PendingButton
        type="submit"
        variant="ghost"
        size="icon"
        title={user.ativo ? "Desativar" : "Reativar"}
      >
        <Power className={`h-4 w-4 ${user.ativo ? "text-emerald-600" : "text-slate-400"}`} />
      </PendingButton>
    </form>
  );
}

function ExcluirDialog({ user }: { user: UserRow }) {
  const [state, formAction] = useFormState(deleteUser, initialActionState);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state.status === "error") toast.error(state.message);
    // sucesso: revalida a lista (o item some).
  }, [state]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Excluir" className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir {user.nome}?</DialogTitle>
          <DialogDescription>
            O acesso de <strong>@{user.username}</strong> será removido
            permanentemente. O histórico de auditoria dele é preservado.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <form action={formAction}>
            <input type="hidden" name="id" value={user.id} />
            <PendingButton type="submit" variant="destructive">
              Excluir
            </PendingButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeslogarTodosButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <LogOut className="mr-2 h-4 w-4" />
          Deslogar todos
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deslogar todos os usuários?</DialogTitle>
          <DialogDescription>
            Encerra as sessões de <strong>todos</strong> — inclusive a sua. Cada
            um precisará entrar de novo com a sua senha. Use ao trocar senhas em
            massa ou por segurança.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <form action={deslogarTodos}>
            <PendingButton type="submit" variant="destructive">
              Deslogar todos
            </PendingButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <NovoUsuarioDialog />
        <DeslogarTodosButton />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <ul className="divide-y">
          {users.map((u) => (
            <li
              key={u.id}
              className={`flex flex-wrap items-center gap-3 p-4 ${
                u.ativo ? "" : "bg-slate-50 opacity-70"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {u.nome.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="truncate">{u.nome}</span>
                  {u.id === currentUserId && (
                    <Badge variant="secondary" className="text-[10px]">
                      você
                    </Badge>
                  )}
                  {!u.ativo && (
                    <Badge variant="outline" className="text-[10px] text-slate-500">
                      inativo
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{u.username} · desde {u.createdAt}
                </p>
              </div>
              <Badge variant="outline" className={`shrink-0 ${ROLE_BADGE[u.role]}`}>
                <Shield className="mr-1 h-3 w-3" />
                {ROLE_LABEL[u.role]}
              </Badge>
              <div className="flex shrink-0 items-center">
                <EditarUsuarioDialog user={u} />
                <ResetSenhaDialog user={u} />
                <AtivarToggle user={u} />
                {u.id !== currentUserId && <ExcluirDialog user={u} />}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
