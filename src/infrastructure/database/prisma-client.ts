import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Reuse one PrismaClient across warm serverless invocations (Vercel).
 * Without this, each cold path can open extra connections under load.
 */
export function createPrismaClient(): PrismaClient {
  const client =
    globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

  globalForPrisma.prisma = client;
  return client;
}

export type { PrismaClient };
