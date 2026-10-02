import { getDashboard } from "@/lib/server/dashboard";
import { errorResponse, jsonResponse } from "@/lib/server/http";

export async function GET(): Promise<Response> {
  try {
    const { data, meta } = await getDashboard();
    return jsonResponse(data, meta);
  } catch (e) {
    return errorResponse(e);
  }
}
