import { handleApi } from "@/lib/server/api";
import { getHistory, isHistoryRange } from "@/lib/server/brapi";
import { BffError } from "@/lib/server/errors";
import { jsonResponse, metaFromResult } from "@/lib/server/http";

type RouteParams = { params: Promise<{ symbol: string }> };

export async function GET(request: Request, context: RouteParams): Promise<Response> {
  return handleApi(request, async () => {
    const { symbol } = await context.params;
    if (!symbol) {
      throw new BffError("BAD_REQUEST", "Informe o symbol na URL.", 400);
    }

    const url = new URL(request.url);
    const range = url.searchParams.get("range") ?? "1m";
    if (!isHistoryRange(range)) {
      throw new BffError("BAD_REQUEST", "range deve ser 1m, 3m, 6m ou 1y.", 400);
    }

    const result = await getHistory(symbol, range);
    return jsonResponse(result.data, metaFromResult("brapi", result));
  });
}
