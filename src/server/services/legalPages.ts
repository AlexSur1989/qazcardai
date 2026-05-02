
import { writeAdminAuditLog } from "@/lib/admin-audit";
import {
  isLegalPageSlug,
  LEGAL_PAGE_PLACEHOLDER_RU,
  LEGAL_PAGE_SEED_DEFAULTS,
  LEGAL_PAGE_STATUS,
  type LegalPageSlug,
  type LegalPageStatusString,
} from "@/lib/legal-page-config";
import { prisma } from "@/lib/prisma";

export type LegalPageStatus = LegalPageStatusString;

export type PublicLegalPage = {
  slug: string;
  title: string;
  content: string;
  publishedAt: Date;
};

export async function getPublicLegalPage(
  slug: string,
): Promise<PublicLegalPage | null> {
  if (!isLegalPageSlug(slug)) return null;
  try {
    const row = await prisma.legalPage.findFirst({
      where: { slug, status: LEGAL_PAGE_STATUS.PUBLISHED },
      select: {
        slug: true,
        title: true,
        content: true,
        publishedAt: true,
      },
    });
    if (!row?.publishedAt) return null;
    return {
      slug: row.slug,
      title: row.title,
      content: row.content,
      publishedAt: row.publishedAt,
    };
  } catch (e) {
    console.error("[getPublicLegalPage]", slug, e);
    return null;
  }
}

export type AdminLegalListItem = {
  slug: string;
  title: string;
  status: string;
  version: number;
  publishedAt: Date | null;
  updatedAt: Date;
};

export async function getAdminLegalPages(): Promise<AdminLegalListItem[]> {
  return prisma.legalPage.findMany({
    orderBy: { slug: "asc" },
    select: {
      slug: true,
      title: true,
      status: true,
      version: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
}

export type AdminLegalPageDetail = {
  slug: string;
  title: string;
  content: string;
  status: string;
  version: number;
  publishedAt: Date | null;
  updatedAt: Date;
};

export async function getAdminLegalPage(
  slug: string,
): Promise<AdminLegalPageDetail | null> {
  if (!isLegalPageSlug(slug)) return null;
  return prisma.legalPage.findUnique({
    where: { slug },
    select: {
      slug: true,
      title: true,
      content: true,
      status: true,
      version: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
}

type UpdateInput = {
  slug: LegalPageSlug;
  title: string;
  content: string;
  status: LegalPageStatus;
  adminUserId: string;
};

export async function updateLegalPage(
  input: UpdateInput,
): Promise<AdminLegalPageDetail> {
  const existing = await prisma.legalPage.findUnique({ where: { slug: input.slug } });
  if (!existing) {
    throw new Error("legal_page_not_found");
  }
  const oldSnapshot = {
    title: existing.title,
    content: existing.content,
    status: existing.status,
    version: existing.version,
    publishedAt: existing.publishedAt,
  };
  const publishedAtSet =
    input.status === LEGAL_PAGE_STATUS.PUBLISHED && !existing.publishedAt
      ? new Date()
      : undefined;

  const row = await prisma.legalPage.update({
    where: { slug: input.slug },
    data: {
      title: input.title,
      content: input.content,
      status: input.status,
      version: { increment: 1 },
      updatedBy: input.adminUserId,
      ...(publishedAtSet ? { publishedAt: publishedAtSet } : {}),
    },
    select: {
      slug: true,
      title: true,
      content: true,
      status: true,
      version: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  await writeAdminAuditLog({
    adminUserId: input.adminUserId,
    action: "LEGAL_PAGE_UPDATED",
    targetType: "LegalPage",
    targetId: input.slug,
    oldValue: oldSnapshot,
    newValue: {
      title: row.title,
      content: row.content,
      status: row.status,
      version: row.version,
      publishedAt: row.publishedAt,
    },
  });

  return row;
}

export async function publishLegalPage(args: {
  slug: LegalPageSlug;
  adminUserId: string;
}): Promise<AdminLegalPageDetail> {
  const existing = await prisma.legalPage.findUnique({ where: { slug: args.slug } });
  if (!existing) {
    throw new Error("legal_page_not_found");
  }
  const oldSnapshot = {
    status: existing.status,
    version: existing.version,
    publishedAt: existing.publishedAt,
  };
  const now = new Date();
  const row = await prisma.legalPage.update({
    where: { slug: args.slug },
    data: {
      status: LEGAL_PAGE_STATUS.PUBLISHED,
      publishedAt: now,
      version: { increment: 1 },
      updatedBy: args.adminUserId,
    },
    select: {
      slug: true,
      title: true,
      content: true,
      status: true,
      version: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
  await writeAdminAuditLog({
    adminUserId: args.adminUserId,
    action: "LEGAL_PAGE_PUBLISHED",
    targetType: "LegalPage",
    targetId: args.slug,
    oldValue: oldSnapshot,
    newValue: {
      status: row.status,
      version: row.version,
      publishedAt: row.publishedAt,
    },
  });
  return row;
}

export type EnsureDefaultsResult = {
  created: number;
  createdSlugs: string[];
};

/**
 * РЎРѕР·РґР°С‘С‚ РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РёРµ СЃС‚СЂР°РЅРёС†С‹ СЃ С‡РµСЂРЅРѕРІРёРєРѕРј. РќРµ РїРµСЂРµР·Р°РїРёСЃС‹РІР°РµС‚ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ Р·Р°РїРёСЃРё.
 */
export async function ensureDefaultLegalPages(): Promise<EnsureDefaultsResult> {
  const createdSlugs: string[] = [];
  for (const def of LEGAL_PAGE_SEED_DEFAULTS) {
    const exists = await prisma.legalPage.findUnique({
      where: { slug: def.slug },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.legalPage.create({
      data: {
        slug: def.slug,
        title: def.title,
        content: LEGAL_PAGE_PLACEHOLDER_RU,
        status: LEGAL_PAGE_STATUS.DRAFT,
        version: 1,
      },
    });
    createdSlugs.push(def.slug);
  }
  return { created: createdSlugs.length, createdSlugs };
}
