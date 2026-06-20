import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { envVars } from "../../../config/env.js";
import AppError from "../../errorHelpers/AppError.js";

type OpenRouterEmbeddingResponse = {
    data?: Array<{ embedding?: number[] }>;
};

type OpenRouterChatResponse = {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
};

const openRouterHeaders = () => ({
    Authorization: `Bearer ${envVars.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": envVars.FRONTEND_URL,
    "X-Title": "LostX Chatbot",
});

const assertApiKey = () => {
    if (!envVars.OPENROUTER_API_KEY?.trim()) {
        throw new AppError(
            StatusCodes.SERVICE_UNAVAILABLE,
            "OpenRouter API key is not configured",
        );
    }
};

export const OpenRouterService = {
    createEmbedding: async (text: string): Promise<number[]> => {
        assertApiKey();

        try {
            const { data } = await axios.post<OpenRouterEmbeddingResponse>(
                `${envVars.OPENROUTER_BASE_URL}/embeddings`,
                {
                    model: envVars.OPENROUTER_EMBEDDING_MODEL,
                    input: text,
                },
                { headers: openRouterHeaders(), timeout: 60_000 },
            );

            const embedding = data.data?.[0]?.embedding;

            if (!embedding?.length) {
                throw new AppError(
                    StatusCodes.BAD_GATEWAY,
                    "OpenRouter returned an empty embedding",
                );
            }

            return embedding;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            const message = axios.isAxiosError(error)
                ? error.response?.data?.error?.message ??
                  error.message
                : "Unknown OpenRouter embedding error";

            throw new AppError(
                StatusCodes.BAD_GATEWAY,
                `Failed to create embedding: ${message}`,
            );
        }
    },

    generateChatCompletion: async (
        systemPrompt: string,
        userPrompt: string,
    ): Promise<string> => {
        assertApiKey();

        try {
            const { data } = await axios.post<OpenRouterChatResponse>(
                `${envVars.OPENROUTER_BASE_URL}/chat/completions`,
                {
                    model: envVars.OPENROUTER_LLM_MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                    ],
                    temperature: 0.3,
                },
                { headers: openRouterHeaders(), timeout: 90_000 },
            );

            const content = data.choices?.[0]?.message?.content?.trim();

            if (!content) {
                throw new AppError(
                    StatusCodes.BAD_GATEWAY,
                    "OpenRouter returned an empty chat completion",
                );
            }

            return content;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            const message = axios.isAxiosError(error)
                ? error.response?.data?.error?.message ??
                  error.message
                : "Unknown OpenRouter chat error";

            throw new AppError(
                StatusCodes.BAD_GATEWAY,
                `Failed to generate chat completion: ${message}`,
            );
        }
    },
};
