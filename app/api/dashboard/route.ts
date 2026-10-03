import { handleApi } from "@/lib/server/api";
import { getDashboard } from "@/lib/server/dashboard";
import { jsonResponse } from "@/lib/server/http";

export async function GET(request: Request): Promise<Response> {
  return handleApi(request, async () => {
    const { data, meta } = await getDashboard();
    return jsonResponse(data, meta);
  });
}
