import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">404</p>
      <h2 className="text-xl font-semibold">Página não encontrada</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        O endereço acessado não existe neste dashboard.
      </p>
      <Link
        href="/"
        className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
      >
        Voltar ao painel
      </Link>
    </main>
  );
}
