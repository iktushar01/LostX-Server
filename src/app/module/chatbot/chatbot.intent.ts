export type SearchIntent = "USER_LOST" | "USER_FOUND" | "LOOKING_FOR_OWNER" | "GENERAL";

export type SearchScope = {
    intent: SearchIntent;
    includeLost: boolean;
    includeFound: boolean;
};

/**
 * Classify what the user is trying to do so retrieval searches the right inventory.
 * - USER_LOST: user lost something → surface FOUND/AVAILABLE items they can claim
 * - USER_FOUND: user found something → show LOST reports + suggest creating a found listing
 * - LOOKING_FOR_OWNER: finder checking if someone reported the item → LOST reports only
 */
export const detectSearchIntent = (query: string): SearchScope => {
    const q = query.toLowerCase().trim();

    if (
        /\b(anyone|somebody|who)\s+(looking|searching)\s+for\b/.test(q) ||
        /\bhas\s+anyone\s+(reported|lost)\b/.test(q) ||
        /\b(is\s+there\s+a\s+lost\s+report)\b/.test(q)
    ) {
        return { intent: "LOOKING_FOR_OWNER", includeLost: true, includeFound: false };
    }

    if (
        /\bi\s+(found|picked\s+up|turned\s+in)\b/.test(q) ||
        (/\bfound\s+(a|an|the)\b/.test(q) && !/\b(has\s+anyone|anyone)\s+found\b/.test(q))
    ) {
        return { intent: "USER_FOUND", includeLost: true, includeFound: false };
    }

    if (
        /\bi\s+(lost|misplaced|can't\s+find|cannot\s+find)\b/.test(q) ||
        /\blost\s+my\b/.test(q) ||
        /\bmissing\s+my\b/.test(q)
    ) {
        return { intent: "USER_LOST", includeLost: false, includeFound: true };
    }

    if (
        /\b(has\s+anyone|anyone)\s+found\b/.test(q) ||
        /\bshow\s+(me\s+)?found\b/.test(q) ||
        /\bfound\s+(items?|phones?|wallets?|id\s*cards?)\b/.test(q)
    ) {
        return { intent: "USER_LOST", includeLost: false, includeFound: true };
    }

    return { intent: "GENERAL", includeLost: true, includeFound: true };
};

export const getIntentGuidance = (intent: SearchIntent): string => {
    switch (intent) {
        case "USER_LOST":
            return `The user lost something. Prioritize FOUND items they may claim. If nothing matches, suggest reporting a lost item at /dashboard/lost/new and browsing found listings. Mention that claiming requires an open lost report with a verification question.`;
        case "USER_FOUND":
            return `The user found something. Show LOST reports from owners who may be searching. Suggest posting a found item at /dashboard/found/new if no owner report matches.`;
        case "LOOKING_FOR_OWNER":
            return `The user wants to know if anyone reported this item as lost. Show matching LOST reports only.`;
        default:
            return `Search both lost reports and found inventory as appropriate.`;
    }
};
