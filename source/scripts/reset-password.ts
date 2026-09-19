import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function resetPassword() {
  try {
    const email = process.argv[2];
    const newPassword = process.argv[3];

    if (!email || !newPassword) {
      console.error("Usage: npm run reset-password <email-or-phone> <new-password>");
      process.exit(1);
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone: email }] },
    });

    if (!user) {
      console.error("User not found");
      process.exit(1);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(newPassword, 10) },
    });

    console.log("Password updated successfully");
  } catch (error) {
    console.error("Error resetting password:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
