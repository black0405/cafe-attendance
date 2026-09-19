import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { rpID, origin, sealChallenge, openChallenge } from "@/lib/webauthn";

// Step 1: employee taps their name; get a challenge bound to their credentials.
export async function GET(request: Request) {
  const userId = Number(new URL(request.url).searchParams.get("userId"));
  const creds = await prisma.webauthnCredential.findMany({
    where: { userId, user: { archived: false } },
    select: { id: true },
  });
  if (creds.length === 0) {
    return NextResponse.json({ error: "Not enrolled" }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({ id: c.id })),
    userVerification: "required",
  });

  return NextResponse.json({
    options,
    token: await sealChallenge(options.challenge, userId),
  });
}

// Step 2: fingerprint signed the challenge; verify and toggle clock in/out.
export async function POST(request: Request) {
  try {
    const { token, response } = await request.json();
    const { challenge, userId } = await openChallenge(token);

    const cred = await prisma.webauthnCredential.findUnique({
      where: { id: response.id },
    });
    if (!cred || cred.userId !== userId) {
      return NextResponse.json(
        { error: "Unknown credential" },
        { status: 400 }
      );
    }

    const { verified, authenticationInfo } =
      await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: cred.id,
          publicKey: new Uint8Array(cred.publicKey),
          counter: cred.counter,
        },
      });
    if (!verified) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 401 }
      );
    }

    await prisma.webauthnCredential.update({
      where: { id: cred.id },
      data: { counter: authenticationInfo.newCounter },
    });

    // Toggle: close the open shift (any day, so late nights work), else open one.
    const open = await prisma.attendanceRecord.findFirst({
      where: { userId, clockOut: null },
      orderBy: { clockIn: "desc" },
    });

    const now = new Date();
    if (open) {
      await prisma.attendanceRecord.update({
        where: { id: open.id },
        data: { clockOut: now },
      });
      return NextResponse.json({ action: "out", timestamp: now });
    }
    await prisma.attendanceRecord.create({ data: { userId, clockIn: now } });
    return NextResponse.json({ action: "in", timestamp: now });
  } catch (error) {
    console.error("Punch error:", error);
    return NextResponse.json({ error: "Punch failed" }, { status: 400 });
  }
}
