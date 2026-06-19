import { ItemCategory } from "../lib/prisma-exports";
import { isSensitiveCategory } from "./privacy.util";

export type ItemVisibilityFlags = {
    showImagePublic: boolean;
    showDescriptionPublic: boolean;
    showLocationPublic: boolean;
};

/** Default public visibility — sensitive categories hide image/description by default. */
export const defaultVisibilityForCategory = (category: ItemCategory): ItemVisibilityFlags => {
    const sensitive = isSensitiveCategory(category);
    return {
        showImagePublic: !sensitive,
        showDescriptionPublic: !sensitive,
        showLocationPublic: false,
    };
};

export const parseVisibilityFlag = (
    value: unknown,
    fallback: boolean,
): boolean => {
    if (value === true || value === "true" || value === "1") return true;
    if (value === false || value === "false" || value === "0") return false;
    return fallback;
};
