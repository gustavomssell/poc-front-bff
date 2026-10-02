import { getMacro } from "@/lib/server/bcb";
import { errorResponse, jsonResponse, metaFromResult } from "@/lib/server/http";

export async function GET(): Promise<Response> {
  try {
    const result = await getMacro();
    return jsonResponse(result.data, metaFromResult("bcb", result));
  } catch (e) {
    return errorResponse(e);
  }
}
