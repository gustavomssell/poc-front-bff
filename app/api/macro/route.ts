import { handleApi } from "@/lib/server/api";
import { getMacro } from "@/lib/server/bcb";
import { jsonResponse, metaFromResult } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  return handleApi(request, async () => {
    const result = await getMacro();
    return jsonResponse(result.data, metaFromResult("bcb", result));
  });
}
