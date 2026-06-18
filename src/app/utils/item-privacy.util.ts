import { ItemCategory } from "../lib/prisma-exports";
import { buildPublicAreaLabel } from "./location.util";
import {
    blurImageUrl,
    isSensitiveCategory,
    LOCATION_HIDDEN_LABEL,
} from "./privacy.util";

export { isSensitiveCategory };

export type PublicItem = {
    category: ItemCategory;
    location: string;
    building?: string | null;
    floor?: string | null;
    room?: string | null;
    imageUrl?: string | null;
    description?: string;
    userId?: string;
    status?: string;
};

type PrivacyContext = {
    viewerUserId?: string | undefined;
    isOwner?: boolean;
    hasApprovedClaim?: boolean;
    isStaffOrAdmin?: boolean;
};

/** Redact sensitive fields for public browse / unauthenticated list views. */
export const applyPublicItemPrivacy = <T extends PublicItem>(
    item: T,
    context: PrivacyContext = {},
): T & { locationHidden?: boolean; imageBlurred?: boolean } => {
    const canSeeDetails =
        context.isOwner ||
        context.isStaffOrAdmin ||
        context.hasApprovedClaim ||
        false;

    if (canSeeDetails) {
        return item;
    }

    const sensitive = isSensitiveCategory(item.category);
    const result = { ...item } as T & { locationHidden?: boolean; imageBlurred?: boolean };

    if (item.category === ItemCategory.ID_CARD || item.category === ItemCategory.WALLET) {
        result.description = "Details hidden for privacy — view after verification.";
    }

    result.location = buildPublicAreaLabel(item);
    result.locationHidden = true;

    if (sensitive && item.imageUrl) {
        const blurred = blurImageUrl(item.imageUrl);
        result.imageUrl = blurred;
        result.imageBlurred = blurred !== null;
        if (!blurred) {
            result.imageUrl = null;
            result.imageBlurred = true;
        }
    }

    return result;
};

/** Found items hide exact location until the viewer has an approved claim. */
export const applyFoundItemLocationPrivacy = <T extends PublicItem>(
    item: T,
    context: PrivacyContext,
): T => {
    if (context.isOwner || context.isStaffOrAdmin || context.hasApprovedClaim) {
        return item;
    }

    return {
        ...item,
        location: `${buildPublicAreaLabel(item)} — ${LOCATION_HIDDEN_LABEL}`,
    };
};
