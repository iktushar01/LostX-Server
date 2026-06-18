import "dotenv/config";
import { prisma } from "../src/app/lib/prisma.js";
import { EmbeddingService } from "../src/app/module/chatbot/embedding.service.js";

const lost = await prisma.$queryRaw<
    Array<{ id: string; title: string; has_emb: boolean }>
>`SELECT id, title, (embedding IS NOT NULL) as has_emb FROM lost_items LIMIT 10`;

console.log("lost items:", lost);

const missing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM lost_items WHERE embedding IS NULL
`;
console.log("missing embeddings:", missing.length);

if (missing[0]) {
    try {
        await EmbeddingService.upsertLostItemEmbedding(missing[0].id);
        console.log("upsert ok for", missing[0].id);
    } catch (e) {
        console.error("upsert failed:", e);
    }
}

await prisma.$disconnect();
