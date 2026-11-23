import { roomAction } from "@/server/rooms";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = roomAction(body);
    return Response.json(res, { status: "error" in res ? 400 : 200 });
  } catch {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }
}
