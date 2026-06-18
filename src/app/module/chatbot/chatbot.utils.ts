import type { ChatbotMatch, ItemEmbeddingType } from "./chatbot.interface";

/** Format a float embedding array for PostgreSQL pgvector literals. */
export const toPgVectorLiteral = (embedding: number[]): string =>
    `[${embedding.join(",")}]`;

/** Build the canonical text blob used for item embeddings. */
export const buildItemEmbeddingText = (
    item: {
        title: string;
        description: string;
        category: string;
        location: string;
        dateLost?: Date;
        dateFound?: Date;
    },
    type: ItemEmbeddingType,
): string => {
    const date =
        type === "LOST"
            ? item.dateLost?.toISOString().slice(0, 10) ?? "unknown"
            : item.dateFound?.toISOString().slice(0, 10) ?? "unknown";

    return `${type} | ${item.category} | ${item.title} | ${item.description} | location: ${item.location} | date: ${date}`;
};

/** Format similarity as a whole-number percentage for RAG context. */
export const formatSimilarityPercent = (similarity: number): string =>
    `${Math.round(similarity * 100)}%`;

/**
 * Step 3 of RAG — group retrieved matches into a compact LLM context block.
 * Pure function for easy unit testing.
 */
export const buildRagContext = (matches: ChatbotMatch[]): string => {
    if (matches.length === 0) {
        return "No matching items were found in the database.";
    }

    const lost = matches.filter((m) => m.type === "LOST");
    const found = matches.filter((m) => m.type === "FOUND");

    const formatLine = (match: ChatbotMatch) =>
        `- [${formatSimilarityPercent(match.similarity)}] ${match.title} | ${match.location} | ${match.status} | category: ${match.category}`;

    const sections: string[] = [];

    if (lost.length > 0) {
        sections.push(`Lost Items:\n${lost.map(formatLine).join("\n")}`);
    }

    if (found.length > 0) {
        sections.push(`Found Items:\n${found.map(formatLine).join("\n")}`);
    }

    return sections.join("\n\n");
};

/** Fallback answer when the LLM is unavailable — uses only retrieved DB rows. */
export const buildFallbackAnswer = (matches: ChatbotMatch[]): string => {
    if (matches.length === 0) {
        return "I couldn't find any close matches in our database right now. Try browsing all items or report a new lost item so we can help you recover it.";
    }

    const top = matches[0]!;
    const confidence = formatSimilarityPercent(top.similarity);

    return `I found ${matches.length} possible match${matches.length === 1 ? "" : "es"} in our database. The closest is a ${top.type.toLowerCase()} item "${top.title}" near ${top.location} (${confidence} confidence). You can view it in Browse Items or submit a claim if it looks like yours.`;
};

export const CHATBOT_SYSTEM_PROMPT = `You are LostX, a helpful university lost-and-found assistant.

Rules:
- ONLY reference items listed in the retrieved context below.
- NEVER invent items, locations, statuses, or owners.
- If no matches exist, say so and suggest reporting a lost item or browsing listings.
- Mention similarity scores as confidence when available.
- Suggest clear next steps: browse the item, submit a claim, or create a lost report.
- Never reveal verification answers or private owner contact details.
- Keep answers concise, friendly, and actionable.`;
