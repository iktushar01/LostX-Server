type LocationParts = {
    building?: string | null;
    floor?: string | null;
    room?: string | null;
    location?: string;
};

/** Compose a display location from structured campus zones + free-text fallback. */
export const buildLocationString = (parts: LocationParts): string => {
    const segments: string[] = [];

    if (parts.building?.trim()) segments.push(parts.building.trim());
    if (parts.floor?.trim()) segments.push(`Floor ${parts.floor.trim()}`);
    if (parts.room?.trim()) segments.push(`Room ${parts.room.trim()}`);

    if (segments.length > 0) {
        return segments.join(", ");
    }

    return parts.location?.trim() || "Unknown";
};

/** Public-facing area label (building only) for privacy-redacted views. */
export const buildPublicAreaLabel = (parts: LocationParts): string => {
    if (parts.building?.trim()) {
        return parts.building.trim();
    }

    const location = parts.location?.trim() ?? "";
    const firstSegment = location.split(",")[0]?.trim();
    return firstSegment || "Campus area";
};
