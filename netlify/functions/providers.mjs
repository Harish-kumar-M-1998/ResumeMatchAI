// Lists the AI providers this deployment has keys for (never the keys).
import { json, methodNotAllowed } from "../lib/http.mjs";
import { publicProviderList } from "../lib/providers.mjs";

export default async function handler(req) {
  if (req.method !== "GET") return methodNotAllowed("GET");
  return json(200, { providers: publicProviderList() }, { "Cache-Control": "public, max-age=300" });
}
