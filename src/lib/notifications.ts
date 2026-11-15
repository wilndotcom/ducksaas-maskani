import { prisma } from "@/lib/prisma";
import type { OrganizationMemberRole } from "@prisma/client";

export async function notifyUser(
  userId: string,
  organizationId: string,
  n: { type: string; title: string; body?: string; link?: string }
) {
  try {
    await prisma.notification.create({
      data: { userId, organizationId, ...n },
    });
  } catch {
    // notifications are best-effort; never break the main flow
  }
}

export async function notifyOrgRoles(
  organizationId: string,
  roles: OrganizationMemberRole[],
  n: { type: string; title: string; body?: string; link?: string }
) {
  try {
    const members = await prisma.organizationMember.findMany({
      where: { organizationId, role: { in: roles } },
      select: { userId: true },
    });
    if (members.length === 0) return;
    await prisma.notification.createMany({
      data: members.map((m) => ({ userId: m.userId, organizationId, ...n })),
    });
  } catch {
    // best-effort
  }
}
