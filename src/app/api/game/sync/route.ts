import { syncRoom } from "@/server/rooms";
import type { SyncBody } from "@/game/shared";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SyncBody;
    const res = syncRoom(body);
    return Response.json(res, { status: "error" in res ? 410 : 200 });
  } catch {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }
}
