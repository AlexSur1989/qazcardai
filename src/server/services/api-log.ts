
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

export type CreateApiLogInput = {
  generationId?: string | null;
  provider: string;
  endpoint: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  statusCode: number | null;
  errorMessage?: string | null;
};

export async function createApiLog(data: CreateApiLogInput) {
  return prisma.apiLog.create({
    data: {
      generationId: data.generationId ?? undefined,
      provider: data.provider.slice(0, 64),
      endpoint: data.endpoint.slice(0, 2048),
      requestPayload:
        data.requestPayload === undefined
          ? undefined
          : (data.requestPayload as Prisma.InputJsonValue),
      responsePayload:
        data.responsePayload === undefined
          ? undefined
          : (data.responsePayload as Prisma.InputJsonValue),
      statusCode: data.statusCode ?? null,
      errorMessage: data.errorMessage?.slice(0, 10000) ?? null,
    },
  });
}
