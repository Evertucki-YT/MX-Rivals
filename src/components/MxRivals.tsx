"use client";

import { useState } from "react";
import Menu, { type Session } from "./Menu";
import RoomView from "./RoomView";

export default function MxRivals() {
  const [session, setSession] = useState<Session | null>(null);
  if (!session) return <Menu onStart={setSession} />;
  return <RoomView key={session.id} session={session} onExit={() => setSession(null)} />;
}
