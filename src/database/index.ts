import { PrismaClient } from '@prisma/client';
import path from 'path';

export const dbPath = path.join(process.cwd(), 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

export const prisma = new PrismaClient();