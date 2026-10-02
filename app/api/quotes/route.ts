import { getQuotes } from "@/lib/server/brapi";
import { BffError } from "@/lib/server/errors";
import { errorResponse, jsonResponse, metaFromResult } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get("symbols");
    if (!raw) {
      throw new BffError("BAD_REQUEST", "Informe symbols=ABC,DEF.", 400);
    }
    const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (symbols.length === 0) {
      throw new BffError("BAD_REQUEST", "symbols vazio.", 400);
    }

    const result = await getQuotes(symbols);
    return jsonResponse(result.data, metaFromResult("brapi", result));
  } catch (e) {
    return errorResponse(e);
  }
}
