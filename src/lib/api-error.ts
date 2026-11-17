import axios from "axios";

/** The `error` text the API sent (such as "Demo admin is read-only"), else `fallback`. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.error;
    if (typeof msg === "string" && msg) return msg;
  }
  return fallback;
}

/** Same for a fetch Response that was not ok. */
export async function responseErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // not JSON
  }
  return fallback;
}
