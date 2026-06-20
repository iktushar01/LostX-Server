import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./prisma-exports.js";
import { envVars } from "../../config/env.js";

const connectionString = `${envVars.DATABASE_URL}`;

const globalForPrisma = globalThis as unknown as {
  prisma?: InstanceType<typeof PrismaClient>;
};

const createPrismaClient = () => {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
};

const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;

export { prisma };
