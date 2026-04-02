import { NextResponse } from 'next/server';

type ValidateBody = {
  accessCode?: string;
  roomId?: string;
};

type ExternalValidateResponse = {
  valid?: boolean;
  name?: string;
  id?: string;
  roomName?: string;
  sessionId?: string;
  error?: string;
};

/**
 * Memvalidasi kredensial akses (access code / room password) ke API eksternal.
 * API eksternal boleh mengembalikan roomName jika ingin mapping password -> room tersembunyi.
 * Respons JSON: `{ valid: boolean }` atau HTTP 2xx = valid, 404 = tidak valid.
 */
export async function POST(req: Request) {
  let body: ValidateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ valid: false as const, error: 'Body JSON tidak valid' }, { status: 400 });
  }

  const accessCode =
    typeof body.accessCode === 'string'
      ? body.accessCode.trim()
      : typeof body.roomId === 'string'
        ? body.roomId.trim()
        : '';
  if (!accessCode) {
    return NextResponse.json(
      { valid: false as const, error: 'Access code wajib diisi' },
      { status: 400 }
    );
  }

  if (process.env.SKIP_ROOM_VALIDATION === 'true') {
    return NextResponse.json({
      valid: true as const,
      name: 'User',
      roomName: accessCode,
      sessionId: accessCode,
    });
  }

  const template = process.env.ROOM_VALIDATION_URL;
  if (!template) {
    return NextResponse.json(
      { valid: false as const, error: 'ROOM_VALIDATION_URL belum dikonfigurasi' },
      { status: 500 }
    );
  }

  const url = `${template.replace(/\/+$/, '')}/${encodeURIComponent(accessCode)}`;

  const method = (process.env.ROOM_VALIDATION_METHOD ?? 'GET').toUpperCase();
  const headers: HeadersInit = {
    Accept: 'application/json',
  };
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    headers['Content-Type'] = 'application/json';
  }
  const apiKey = process.env.ROOM_VALIDATION_API_KEY;
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body:
        method === 'POST' || method === 'PUT' || method === 'PATCH'
          ? JSON.stringify({ accessCode, roomId: accessCode })
          : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status === 404) {
      return NextResponse.json({ valid: false as const, error: 'Access code tidak ditemukan' });
    }

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({
        valid: false as const,
        error: text || `Validasi gagal (HTTP ${res.status})`,
      });
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as ExternalValidateResponse;
      if (typeof data.valid === 'boolean') {
        if (data.valid !== true) {
          return NextResponse.json({
            valid: false as const,
            error: data.error ?? 'Access code tidak valid',
          });
        }

        const resolvedRoomName = (data.roomName ?? data.id ?? accessCode).trim();
        const resolvedName = (data.name ?? 'User').trim();
        const resolvedSessionId = (data.sessionId ?? '').trim();

        if (!resolvedSessionId) {
          return NextResponse.json(
            {
              valid: false as const,
              error: 'Response API valid tidak memiliki sessionId',
            },
            { status: 502 }
          );
        }

        return NextResponse.json({
          valid: true as const,
          name: resolvedName,
          roomName: resolvedRoomName,
          sessionId: resolvedSessionId,
        });
      }
    }

    return NextResponse.json({
      valid: true as const,
      name: 'User',
      roomName: accessCode,
      sessionId: accessCode,
    });
  } catch (e) {
    console.error('room/validate:', e);
    return NextResponse.json(
      { valid: false as const, error: 'Tidak dapat menghubungi API validasi' },
      { status: 502 }
    );
  }
}
