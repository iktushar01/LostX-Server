import type { Request } from "express";
import { uploadFileToCloudinary } from "../../config/cloudinary.config";

export const getUploadedImageUrl = async (req: Request): Promise<string | null> => {
    const file = (req as Request & { file?: Express.Multer.File }).file;

    if (!file?.buffer || !file.originalname) {
        return null;
    }

    const result = await uploadFileToCloudinary(file.buffer, file.originalname);
    return result.secure_url;
};
