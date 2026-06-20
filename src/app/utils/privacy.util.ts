import { ItemCategory } from "../lib/prisma-exports.js";

const SENSITIVE_CATEGORIES = new Set<ItemCategory>([
    ItemCategory.ID_CARD,
    ItemCategory.WALLET,
    ItemCategory.PHONE,
]);

export const isSensitiveCategory = (category: ItemCategory | string): boolean =>
    SENSITIVE_CATEGORIES.has(category as ItemCategory);

/** Apply Cloudinary blur transform for sensitive item photos in public views. */
export const blurImageUrl = (imageUrl: string | null | undefined): string | null => {
    if (!imageUrl) return null;

    if (imageUrl.includes("res.cloudinary.com") && imageUrl.includes("/upload/")) {
        return imageUrl.replace("/upload/", "/upload/e_blur:1200/");
    }

    return null;
};

export const LOCATION_HIDDEN_LABEL = "Exact location revealed after claim approval";
