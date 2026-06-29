import { redirect } from "next/navigation";

// Não há página de boas-vindas: a raiz leva direto ao painel (que exige login).
export default function RootPage() {
  redirect("/admin");
}
