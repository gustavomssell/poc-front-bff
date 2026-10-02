import { getMarket } from "@/lib/server/brapi";
import { errorResponse, jsonResponse, metaFromResult } from "@/lib/server/http";
import { BffError } from "@/lib/server/errors";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sp = url.searchParams;

    const page = Number(sp.get("page") ?? "1");
    const limit = Number(sp.get("limit") ?? "20");
    if (Number.isNaN(page) || page < 1) {
      throw new BffError("BAD_REQUEST", "page deve ser >= 1.", 400);
    }
    if (Number.isNaN(limit) || limit < 1 || limit > 50) {
      throw new BffError("BAD_REQUEST", "limit deve estar entre 1 e 50.", 400);
    }

    const order = sp.get("order") === "asc" ? "asc" : "desc";

    const result = await getMarket({
      q: sp.get("q") ?? undefined,
      type: sp.get("type") ?? undefined,
      subType: sp.get("subType") ?? undefined,
      sector: sp.get("sector") ?? undefined,
      sort: sp.get("sort") ?? undefined,
      order,
      page,
      limit,
    });

    return jsonResponse(result.data, metaFromResult("brapi", result));
  } catch (e) {
    return errorResponse(e);
  }
}
