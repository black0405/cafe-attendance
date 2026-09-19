import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  rpName,
  rpID,
  origin,
  sealChallenge,
  openChallenge,
} from "@/lib/webauthn";

// Step 1: admin picks a staff member, gets WebAuthn creation options.
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(new URL(request.url).searchParams.get("userId"));
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { credentials: { select: { id: true } } },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(String(user.id)),
    userName: user.phone || user.email || String(user.id),
    userDisplayName: user.name || user.phone || String(user.id),
    attestationType: "none",
    excludeCredentials: user.credentials.map((c) => ({ id: c.id })),
    authenticatorSelection: {
      authenticatorAttachment: "platform", // built-in reader, not USB keys
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  return NextResponse.json({
    options,
    token: await sealChallenge(options.challenge, user.id),
  });
}

// Step 2: browser returns the attestation; store the public key.
export async function POST(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { token, response, label } = await request.json();
    const { challenge, userId } = await openChallenge(token);

    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verified || !registrationInfo) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
    }

    const { credential } = registrationInfo;
    await prisma.webauthnCredential.create({
      data: {
        id: credential.id,
        userId,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        label: label || null,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Enroll error:", error);
    return NextResponse.json({ error: "Enrollment failed" }, { status: 400 });
  }
}

// Admin removes all of a staff member's devices (revoke).
export async function DELETE(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(new URL(request.url).searchParams.get("userId"));
  await prisma.webauthnCredential.deleteMany({ where: { userId } });
  return NextResponse.json({ success: true });
}
