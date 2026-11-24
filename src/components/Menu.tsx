"use client";

import { useEffect, useState } from "react";
import { initAudio, sfx } from "@/game/audio";
import { p2p } from "@/game/net";

export interface Session {
  code: string;
  id: string;
  name: string;
}

async function api(body: Record<string, unknown>) {
  return p2p.startSession({
    action: String(body.action || ""),
    name: String(body.name || "Jugador"),
    size: Number(body.size || 2),
    code: body.code ? String(body.code) : undefined,
  });
}
