export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 p-6 text-center">
      <h1 className="text-5xl font-bold text-slate-900">404</h1>
      <p className="text-slate-600">
        Página ou link de votação não encontrado.
      </p>
      <p className="text-sm text-slate-400">
        Verifique o endereço do link de votação que você recebeu.
      </p>
    </main>
  );
}
