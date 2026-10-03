"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Erro inesperado
      </p>
      <h2 className="text-xl font-semibold">Não foi possível renderizar o painel</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Ocorreu um erro ao montar a página. Tente novamente — se persistir,
        confira a saída do servidor e os logs do BFF.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">digest: {error.digest}</p>
      ) : null}
      <Button onClick={() => retry()}>Tentar novamente</Button>
    </main>
  );
}
