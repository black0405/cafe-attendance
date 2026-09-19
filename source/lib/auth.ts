import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import type { User as PrismaUser } from ".prisma/client";

// Phones are stored as digits only so "+91 98765 43210" and "9876543210" match.
export const normalizePhone = (raw: unknown) => String(raw ?? "").replace(/\D/g, "");

// Users log in with either email or phone; both are unique.
export const loginWhere = (login: string) => ({
  OR: [{ email: login }, { phone: normalizePhone(login) || "-" }],
});

export interface User {
  id: string | number;
  email: string | null;
  phone?: string | null;
  name: string | null;
  is_admin: boolean;
  ptp: string | null;
  ptp_verified?: boolean;
}

export async function validateAuth(
  email: string,
  ptp?: string
): Promise<User | null> {
  try {
    if (!email) {
      console.log("No email provided");
      return null;
    }

    console.log("Validating auth for:", email, "PTP:", ptp);

    const user = await prisma.user.findFirst({
      where: loginWhere(email),
      select: {
        id: true,
        email: true,
        name: true,
        is_admin: true,
        ptp: true,
        ptp_verified: true,
      },
    });

    if (!user) {
      console.log("No user found in database for email:", email);
      return null;
    }

    if (user.is_admin) {
      console.log("Admin user - skipping PTP check");
      return user;
    }

    if (!ptp || ptp !== user.ptp) {
      console.log("PTP mismatch or missing - authentication failed");
      return null;
    }

    console.log("Auth successful for:", email);
    return user;
  } catch (error) {
    console.error("Auth validation error:", error);
    return null;
  }
}

export async function validateCredentials(
  email: string,
  password: string
): Promise<User | null> {
  try {
    console.log("Validating credentials for:", email);

    const user = await prisma.user.findFirst({
      where: loginWhere(email),
      select: {
        id: true,
        email: true,
        name: true,
        is_admin: true,
        ptp: true,
        ptp_verified: true,
        password: true,
      },
    });

    if (!user) {
      console.log("User not found");
      return null;
    }

    if (!(await checkPassword(password, user.password))) {
      console.log("Password mismatch");
      return null;
    }

    // Upgrade legacy plain-text rows to bcrypt on first successful login.
    if (!isHashed(user.password)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: await hashPassword(password) },
      });
    }

    console.log("Credentials validated successfully");

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin,
      ptp: user.ptp,
      ptp_verified: user.ptp_verified,
    };
  } catch (error) {
    console.error("Error validating credentials:", error);
    return null;
  }
}

const isHashed = (stored: string) => /^\$2[aby]\$/.test(stored);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function checkPassword(
  plain: string,
  stored: string
): Promise<boolean> {
  return isHashed(stored) ? bcrypt.compare(plain, stored) : plain === stored;
}

// Admin gate for API routes: reads the x-user-email / x-user-ptp headers.
export async function requireAdmin(request: Request): Promise<User | null> {
  const user = await validateAuth(
    request.headers.get("x-user-email") || "",
    request.headers.get("x-user-ptp") || ""
  );
  return user?.is_admin ? user : null;
}

export async function generatePTP(): Promise<string> {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
