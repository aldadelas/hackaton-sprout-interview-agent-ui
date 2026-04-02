import { NextResponse } from "next/server";
import {
  AccessToken,
  type AccessTokenOptions,
  type VideoGrant,
} from "livekit-server-sdk";
import { RoomConfiguration, TokenSourceRequest } from "@livekit/protocol";

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

// NOTE: you are expected to define the following environment variables in `.env.local`:
const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// don't cache the results
export const revalidate = 0;

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    throw new Error(
      "THIS API ROUTE IS INSECURE. DO NOT USE THIS ROUTE IN PRODUCTION WITHOUT AN AUTHENTICATION LAYER.",
    );
  }

  try {
    if (LIVEKIT_URL === undefined) {
      throw new Error("LIVEKIT_URL is not defined");
    }
    if (API_KEY === undefined) {
      throw new Error("LIVEKIT_API_KEY is not defined");
    }
    if (API_SECRET === undefined) {
      throw new Error("LIVEKIT_API_SECRET is not defined");
    }

    const rawBody = await req.json();
    const tokenRequest = TokenSourceRequest.fromJson(rawBody, {
      ignoreUnknownFields: true,
    });
    const roomConfig =
      tokenRequest.roomConfig ??
      RoomConfiguration.fromJson(rawBody?.room_config, {
        ignoreUnknownFields: true,
      });
    const dispatchMetadata = roomConfig?.agents?.[0]?.metadata;
    const roomMetadata = roomConfig?.metadata;

    const requestedRoom = tokenRequest.roomName?.trim();
    const roomName =
      requestedRoom && requestedRoom.length > 0
        ? requestedRoom
        : `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    // Generate participant token
    const participantName = "user";
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      roomConfig,
    );

    console.info("[dispatch-check][server] token request accepted", {
      requestedRoom: requestedRoom ?? null,
      resolvedRoomName: roomName,
      hasAgentDispatchMetadata: Boolean(dispatchMetadata),
      agentDispatchMetadata: dispatchMetadata ?? null,
      hasRoomMetadata: Boolean(roomMetadata),
      roomMetadata: roomMetadata ?? null,
    });

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName,
      participantToken,
    };
    const headers = new Headers({
      "Cache-Control": "no-store",
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  roomConfig: RoomConfiguration,
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: "15m",
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (roomConfig) {
    at.roomConfig = roomConfig;
  }

  return at.toJwt();
}
