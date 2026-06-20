import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./prisma-exports.js";
import { envVars } from "../../config/env.js";

const connectionString = `${envVars.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
