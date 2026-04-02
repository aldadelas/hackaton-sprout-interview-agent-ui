"use client";

import { useMemo, useState } from "react";
import type { AppConfig } from "@/app-config";
import { AppSessionRoot } from "@/components/app/app-session-root";
import { RoomEntryGate } from "@/components/app/room-entry-gate";

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  const [gatePayload, setGatePayload] = useState<{
    roomName: string;
    name: string;
    sessionId: string;
  } | null>(null);
  const needsRoomGate = appConfig.requiresRoomEntry !== false;

  const combinedRoomName = useMemo(() => {
    if (!gatePayload) return undefined;
    const safeName = gatePayload.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "");
    const safeSessionId = gatePayload.sessionId
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "");
    return `${safeName || "user"}_${safeSessionId || "session"}`;
  }, [gatePayload]);

  if (needsRoomGate && gatePayload === null) {
    return (
      <RoomEntryGate
        queryParamKey={appConfig.roomIdQueryParam ?? "accessCode"}
        onSuccess={(payload) => setGatePayload(payload)}
      />
    );
  }

  return (
    <AppSessionRoot
      appConfig={appConfig}
      roomName={combinedRoomName}
      displayName={gatePayload?.name}
      roomMetadata={
        gatePayload
          ? {
              name: gatePayload.name,
              sessionId: gatePayload.sessionId,
            }
          : undefined
      }
    />
  );
}
