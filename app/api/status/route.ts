import { serverAiInfo } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const info = serverAiInfo();
  return Response.json({
    serverConfigured: info.configured,
    model: info.model,
    source: info.configured ? "env" : "none"
  });
}
