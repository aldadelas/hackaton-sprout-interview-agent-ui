'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface RoomEntryGateProps {
  /** Nama query string untuk pre-fill, mis. `accessCode` → `?accessCode=abc` */
  queryParamKey?: string;
  onSuccess: (payload: { roomName: string; name: string; sessionId: string }) => void;
}

export function RoomEntryGate({ queryParamKey = 'accessCode', onSuccess }: RoomEntryGateProps) {
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  const validate = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setError('Masukkan password / access code');
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        const res = await fetch('/api/room/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessCode: trimmed }),
        });
        const data = (await res.json()) as {
          valid?: boolean;
          name?: string;
          roomName?: string;
          sessionId?: string;
          error?: string;
        };
        if (data.valid === true) {
          const resolvedRoomName = (data.roomName ?? trimmed).trim();
          const resolvedName = (data.name ?? 'User').trim();
          const resolvedSessionId = (data.sessionId ?? '').trim();
          if (!resolvedSessionId) {
            setError('sessionId tidak ditemukan dari API validasi');
            return;
          }

          onSuccess({
            roomName: resolvedRoomName,
            name: resolvedName,
            sessionId: resolvedSessionId,
          });
          return;
        }
        setError(data.error ?? 'Access code tidak valid');
      } catch {
        setError('Gagal memvalidasi access code');
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || autoTried) return;
    const fromQuery = new URLSearchParams(window.location.search).get(queryParamKey)?.trim();
    if (fromQuery) {
      setAccessCode(fromQuery);
      setAutoTried(true);
      void validate(fromQuery);
    } else {
      setAutoTried(true);
    }
  }, [autoTried, queryParamKey, validate]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-gate-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/85 p-4 backdrop-blur-md"
    >
      <div className="border-input/50 bg-card text-card-foreground w-full max-w-md rounded-2xl border p-6 shadow-lg">
        <h1 id="room-gate-title" className="text-lg font-semibold tracking-tight">
          Autentikasi akses
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Masukkan password / access code
        </p>

        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void validate(accessCode);
          }}
        >
          <label htmlFor="access-code-input" className="text-sm font-medium">
            Access code
          </label>
          <input
            id="access-code-input"
            name="accessCode"
            type="text"
            autoComplete="off"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            disabled={submitting}
            placeholder="contoh: demo-pass-2026"
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="mt-1 w-full rounded-full font-mono text-xs font-bold tracking-wider uppercase" disabled={submitting}>
            {submitting ? (
              <>
                <Loader className="size-4 animate-spin" aria-hidden />
                Memvalidasi…
              </>
            ) : (
              'Lanjut'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
