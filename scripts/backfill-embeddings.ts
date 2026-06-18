import "dotenv/config";
import { ChatbotService } from "../src/app/module/chatbot/chatbot.service.js";

const main = async () => {
    console.log("Starting embedding backfill...");

    const result = await ChatbotService.reindexMissingEmbeddings();

    console.log("Backfill complete:", result);

    if (result.failed > 0) {
        process.exitCode = 1;
    }
};

main().catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
});
