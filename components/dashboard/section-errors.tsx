import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Erros parciais por fonte — contrato de resiliência do BFF. */
export function SectionErrors({
  errors,
}: {
  errors: { source: string; code: string; message: string }[];
}) {
  if (errors.length === 0) return null;
  return (
    <Alert>
      <TriangleAlertIcon />
      <AlertTitle>
        {errors.length === 1
          ? "Uma fonte falhou nesta carga"
          : `${errors.length} fontes falharam nesta carga`}
      </AlertTitle>
      <AlertDescription>
        {errors.map((e, i) => (
          <span key={i} className="block">
            <span className="font-mono text-xs">
              {e.source} · {e.code}
            </span>{" "}
            — {e.message}
          </span>
        ))}
      </AlertDescription>
    </Alert>
  );
}
