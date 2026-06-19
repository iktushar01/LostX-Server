import { StatusCodes } from "http-status-codes";
import AppError from "../../errorHelpers/AppError";
import { OpenRouterService } from "../chatbot/openrouter.service";

export type AiVerificationQuestion = {
    id: string;
    question: string;
};

export type AiVerificationAnswer = {
    id: string;
    answer: string;
};

export type AiVerificationResult = {
    confidence: number;
    recommendation: "APPROVE" | "REVIEW" | "REJECT";
    reasoning: string;
};

const parseJsonBlock = <T>(raw: string): T => {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = fenced?.[1]?.trim() ?? trimmed;

    try {
        return JSON.parse(jsonText) as T;
    } catch {
        throw new AppError(
            StatusCodes.BAD_GATEWAY,
            "AI returned an invalid JSON response",
        );
    }
};

export const VerificationAiService = {
    generateQuestions: async (input: {
        lostTitle: string;
        lostPublicDescription: string;
        lostPrivateDetails: string;
        foundTitle: string;
        foundPublicDescription: string;
        foundPrivateDetails: string;
    }): Promise<AiVerificationQuestion[]> => {
        const systemPrompt = `You are a lost-and-found verification assistant for a university campus.
Generate ownership verification questions based ONLY on private identifying details provided.
Rules:
- Return valid JSON only: { "questions": [ { "id": "q1", "question": "..." }, ... ] }
- Generate exactly 3 questions.
- Questions must be answerable only by the true owner who knows private details.
- NEVER include or hint at the correct answers in the questions.
- Do not quote private details verbatim — ask about them indirectly.
- Keep each question under 200 characters.`;

        const userPrompt = `Lost item: ${input.lostTitle}
Lost public summary: ${input.lostPublicDescription}
Lost private details (owner-only): ${input.lostPrivateDetails}

Found item: ${input.foundTitle}
Found public summary: ${input.foundPublicDescription}
Found private details (finder-only): ${input.foundPrivateDetails}`;

        const content = await OpenRouterService.generateChatCompletion(systemPrompt, userPrompt);
        const parsed = parseJsonBlock<{ questions?: AiVerificationQuestion[] }>(content);
        const questions = parsed.questions?.filter((q) => q.id && q.question)?.slice(0, 3) ?? [];

        if (questions.length === 0) {
            throw new AppError(
                StatusCodes.BAD_GATEWAY,
                "AI failed to generate verification questions",
            );
        }

        return questions;
    },

    scoreAnswers: async (input: {
        lostPrivateDetails: string;
        foundPrivateDetails: string;
        questions: AiVerificationQuestion[];
        answers: AiVerificationAnswer[];
    }): Promise<AiVerificationResult> => {
        const systemPrompt = `You are a lost-and-found claim verifier.
Score whether the claimant's answers prove ownership using the private reference details.
Return valid JSON only:
{
  "confidence": 0-100,
  "recommendation": "APPROVE" | "REVIEW" | "REJECT",
  "reasoning": "brief explanation"
}
Use semantic matching — exact wording is not required.
APPROVE if confidence >= 80 and answers align with private details.
REJECT if confidence < 40 or answers contradict private details.
Otherwise REVIEW.`;

        const qaBlock = input.questions
            .map((q) => {
                const answer = input.answers.find((a) => a.id === q.id)?.answer ?? "";
                return `Q (${q.id}): ${q.question}\nA: ${answer}`;
            })
            .join("\n\n");

        const userPrompt = `Private lost details: ${input.lostPrivateDetails}
Private found details: ${input.foundPrivateDetails}

Claimant Q&A:
${qaBlock}`;

        const content = await OpenRouterService.generateChatCompletion(systemPrompt, userPrompt);
        const parsed = parseJsonBlock<AiVerificationResult>(content);

        const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)));
        const recommendation =
            parsed.recommendation === "APPROVE" ||
            parsed.recommendation === "REVIEW" ||
            parsed.recommendation === "REJECT"
                ? parsed.recommendation
                : confidence >= 80
                  ? "APPROVE"
                  : confidence < 40
                    ? "REJECT"
                    : "REVIEW";

        return {
            confidence,
            recommendation,
            reasoning: parsed.reasoning?.trim() || "AI verification completed",
        };
    },
};
