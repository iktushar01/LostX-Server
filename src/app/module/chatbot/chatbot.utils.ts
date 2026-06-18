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

/** Format unified match score (0–100) for display. */
export const formatMatchScore = (score: number): string => `${Math.round(score)}%`;

const STOP_WORDS = new Set([
    "a",
    "an",
    "the",
    "my",
    "i",
    "me",
    "we",
    "our",
    "is",
    "are",
    "was",
    "were",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "lost",
    "found",
    "item",
    "items",
    "near",
    "at",
    "in",
    "on",
    "by",
    "for",
    "to",
    "of",
    "and",
    "or",
    "with",
    "yesterday",
    "today",
    "tomorrow",
    "building",
    "campus",
    "show",
    "find",
    "search",
    "looking",
    "anyone",
    "someone",
    "help",
]);

/** Pull meaningful tokens from a natural-language chat query. */
export const extractSearchTerms = (query: string): string[] => {
    const normalized = query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const terms = normalized
        .split(" ")
        .filter((word) => word.length > 1 && !STOP_WORDS.has(word));

    return [...new Set(terms)];
};

/** Map common phrases to ItemCategory enum values for keyword matching. */
export const phraseToCategoryHints = (query: string): string[] => {
    const q = query.toLowerCase();
    const hints: string[] = [];

    if (/\bid\s*card\b|\bstudent\s*id\b/.test(q)) hints.push("ID_CARD");
    if (/\bwallet\b/.test(q)) hints.push("WALLET");
    if (/\bphone\b|\bmobile\b|\biphone\b|\bandroid\b/.test(q)) hints.push("PHONE");
    if (/\blaptop\b|\bmacbook\b|\bcomputer\b/.test(q)) hints.push("LAPTOP");
    if (/\bkeys?\b|\bkeychain\b/.test(q)) hints.push("KEYS");
    if (/\bbag\b|\bbackpack\b|\bpurse\b/.test(q)) hints.push("BAG");
    if (/\bbook\b|\bnotebook\b/.test(q)) hints.push("BOOK");

    return hints;
};

/** Score how well an item row matches extracted search terms (0–1). */
export const scoreKeywordMatch = (
    item: {
        title: string;
        description: string;
        category: string;
        location: string;
    },
    terms: string[],
    categoryHints: string[],
    fullQuery: string,
): number => {
    if (terms.length === 0 && categoryHints.length === 0) {
        return 0;
    }

    const title = item.title.toLowerCase();
    const description = item.description.toLowerCase();
    const location = item.location.toLowerCase();
    const category = item.category.toLowerCase();
    const query = fullQuery.toLowerCase();

    let score = 0;

    if (query.length > 2 && title.includes(query.trim())) {
        score = Math.max(score, 0.98);
    }

    for (const hint of categoryHints) {
        if (category === hint.toLowerCase()) {
            score = Math.max(score, 0.92);
        }
    }

    const matchedTerms = terms.filter(
        (term) =>
            title.includes(term) ||
            description.includes(term) ||
            location.includes(term) ||
            category.includes(term.replace(/_/g, "")),
    );

    if (matchedTerms.length === terms.length && terms.length > 0) {
        score = Math.max(score, 0.9);
    } else if (matchedTerms.length > 0) {
        score = Math.max(score, 0.55 + (matchedTerms.length / terms.length) * 0.3);
    }

    return Math.min(score, 0.99);
};

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
        `- [${formatMatchScore(match.score)}] ${match.title} | ${match.location} | ${match.status} | category: ${match.category}`;

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
    const confidence = formatMatchScore(top.score);

    const intentHint =
        top.type === "FOUND"
            ? " If it looks like yours, open the item and submit a claim (you'll need an open lost report with a verification answer)."
            : " This is someone's lost report — contact may be coordinated after a claim is approved.";

    return `I found ${matches.length} possible match${matches.length === 1 ? "" : "es"} in our database. The closest is a ${top.type.toLowerCase()} item "${top.title}" near ${top.location} (${confidence} match).${intentHint}`;
};

export const CHATBOT_SYSTEM_PROMPT = `You are LostX, a helpful university lost-and-found assistant.

Rules:
- ONLY reference items listed in the retrieved context below.
- NEVER invent items, locations, statuses, or owners.
- If the context lists matching items, describe them and help the user — do NOT say nothing was found.
- Lost items in the context are existing reports from people searching; found items are in inventory and may be claimed.
- If the user lost something, focus on FOUND items they can claim — not other people's lost reports.
- If the user found something, focus on LOST reports from owners and suggest posting a found item.
- If no matches exist in context, say so and suggest the right next step (report lost, post found, or browse).
- Mention match scores as confidence when available.
- To claim a found item, the user needs an open lost report with a verification question and answer.
- Never reveal verification answers or private owner contact details.
- Keep answers concise, friendly, and actionable.`;
