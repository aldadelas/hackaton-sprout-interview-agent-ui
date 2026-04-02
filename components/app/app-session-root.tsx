'use client';

import { useEffect, useMemo } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import { getSandboxTokenSource } from '@/lib/utils';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();

  return null;
}

interface AppSessionRootProps {
  appConfig: AppConfig;
  /** Wajib jika `requiresRoomEntry` aktif; jika tidak, boleh diomit agar token memakai room acak (dev). */
  roomName?: string;
  /** Nama user yang valid lewat API eksternal (ditampilkan di welcome view). */
  displayName?: string;
  /** Metadata untuk dispatch agent (akan di-serialize ke JSON string). */
  roomMetadata?: {
    name: string;
    sessionId: string;
  };
}

export function AppSessionRoot({
  appConfig,
  roomName,
  displayName,
  roomMetadata,
}: AppSessionRootProps) {
  const resolvedRoomName = useMemo(() => {
    if (roomName?.trim()) return roomName.trim();
    return `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;
  }, [roomName]);

  const serializedRoomMetadata = useMemo(() => {
    if (!roomMetadata?.name || !roomMetadata?.sessionId) return undefined;
    return JSON.stringify({
      name: roomMetadata.name,
      sessionId: roomMetadata.sessionId,
    });
  }, [roomMetadata]);

  const tokenSource = useMemo(() => {
    return typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string'
      ? getSandboxTokenSource(appConfig, serializedRoomMetadata)
      : TokenSource.custom(async (options) => {
          const res = await fetch('/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              room_name: options.roomName ?? resolvedRoomName,
              room_config: {
                ...(serializedRoomMetadata ? { metadata: serializedRoomMetadata } : {}),
                ...(options.agentName || options.agentMetadata
                  ? {
                      agents: [
                        {
                          agent_name: options.agentName ?? '',
                          ...(options.agentMetadata ? { metadata: options.agentMetadata } : {}),
                        },
                      ],
                    }
                  : {}),
              },
            }),
          });
          return await res.json();
        });
  }, [appConfig, serializedRoomMetadata, resolvedRoomName]);

  const sessionOptions = useMemo(() => {
    return {
      roomName: resolvedRoomName,
      ...(serializedRoomMetadata ? { agentName: appConfig.agentName ?? '' } : {}),
      ...(appConfig.agentName ? { agentName: appConfig.agentName } : {}),
      ...(serializedRoomMetadata ? { agentMetadata: serializedRoomMetadata } : {}),
    };
  }, [resolvedRoomName, appConfig.agentName, serializedRoomMetadata]);

  const session = useSession(tokenSource, sessionOptions);

  useEffect(() => {
    if (!IN_DEVELOPMENT) return;
    console.info('[dispatch-check][client] session options', {
      roomName: sessionOptions.roomName,
      agentName: sessionOptions.agentName,
      agentMetadata: sessionOptions.agentMetadata,
      roomMetadata: serializedRoomMetadata ?? null,
    });
  }, [sessionOptions, serializedRoomMetadata]);

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController appConfig={appConfig} displayName={displayName} />
      </main>
      <StartAudioButton label="Start Audio" />
      <Toaster
        icons={{
          warning: <WarningIcon weight="bold" />,
        }}
        position="top-center"
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
      />
    </AgentSessionProvider>
  );
}
