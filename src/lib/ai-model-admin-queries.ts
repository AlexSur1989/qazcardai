import { prisma } from "@/lib/prisma";

export async function getAdminAiModelById(id: string) {
  try {
    return await prisma.aiModel.findUnique({ where: { id } });
  } catch {
    return null;
  }
}
