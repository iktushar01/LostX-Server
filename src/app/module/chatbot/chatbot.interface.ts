export type ItemEmbeddingType = "LOST" | "FOUND";

export type ChatbotMatch = {
    id: string;
    type: ItemEmbeddingType;
    title: string;
    description: string;
    category: string;
    location: string;
    imageUrl: string | null;
    status: string;
    date: string;
    similarity: number;
};

export type ChatbotMeta = {
    matchCount: number;
    topSimilarity: number | null;
};

export type ChatbotResponse = {
    answer: string;
    matches: ChatbotMatch[];
    meta: ChatbotMeta;
};

export type ItemEmbeddingFields = {
    title: string;
    description: string;
    category: string;
    location: string;
    dateLost?: Date;
    dateFound?: Date;
};

export type ReindexResult = {
    lostProcessed: number;
    foundProcessed: number;
    failed: number;
};
