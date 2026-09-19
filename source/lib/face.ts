import { prisma } from "./prisma";

// face-api.js descriptors are 128 float32 values. Two descriptors of the same
// person are usually < 0.5 apart (Euclidean); strangers are > 0.6.
export const DESCRIPTOR_LENGTH = 128;
export const MATCH_THRESHOLD = 0.5;

export function toBytes(descriptor: number[]): Buffer {
  if (descriptor.length !== DESCRIPTOR_LENGTH || descriptor.some((n) => typeof n !== "number")) {
    throw new Error("Invalid face descriptor");
  }
  return Buffer.from(new Float32Array(descriptor).buffer);
}

function distance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < DESCRIPTOR_LENGTH; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

// 1:N match against every enrolled face. ponytail: linear scan, fine for a cafe;
// index it if the staff list ever reaches thousands.
export async function matchFace(descriptor: number[]) {
  const probe = new Float32Array(descriptor);
  const faces = await prisma.faceDescriptor.findMany({
    where: { user: { archived: false } },
    include: { user: { select: { id: true, name: true, phone: true } } },
  });
  let best: { userId: number; name: string; distance: number } | null = null;
  for (const f of faces) {
    const stored = new Float32Array(new Uint8Array(f.descriptor).buffer);
    const d = distance(probe, stored);
    if (d < MATCH_THRESHOLD && (!best || d < best.distance)) {
      best = {
        userId: f.user.id,
        name: f.user.name || f.user.phone || `Staff #${f.user.id}`,
        distance: d,
      };
    }
  }
  return best;
}
