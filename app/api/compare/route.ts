import { handleApi } from "@/lib/server/api";
import { getCompare, isHistoryRange } from "@/lib/server/brapi";
import { BffError } from "@/lib/server/errors";
import { jsonResponse, metaFromResult } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  return handleApi(request, async () => {
    const url = new URL(request.url);
    const raw = url.searchParams.get("symbols");
    if (!raw) {
      throw new BffError("BAD_REQUEST", "Informe symbols=ABC,DEF.", 400);
    }
    const range = url.searchParams.get("range") ?? "1m";
    if (!isHistoryRange(range)) {
      throw new BffError("BAD_REQUEST", "range deve ser 1m, 3m, 6m ou 1y.", 400);
    }

    const result = await getCompare(raw.split(","), range);
    return jsonResponse(result.data, metaFromResult("brapi", result));
  });
}
