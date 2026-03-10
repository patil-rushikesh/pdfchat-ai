import axios from "axios";


const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const EMBEDDING_MODEL = "nomic-embed-text";
const CHAT_MODEL = "llama3.2:3b";

/**
 * Generate embedding for a single text
 */
export const getEmbeddings = async (text: string): Promise<number[]> => {
    try {
        const response = await axios.post(`${OLLAMA_URL}/api/embeddings`, {
            model: EMBEDDING_MODEL,
            prompt: text
        });

        return response.data.embedding;
    } catch (error) {
        console.error("Embedding error:", error);
        throw new Error("Failed to generate embeddings");
    }
};

/**
 * Generate embeddings for chunks
 */
export const embedChunks = async (chunks: string[]): Promise<number[][]> => {
    try {
        const CONCURRENCY = 5;
        const allEmbeddings: number[][] = [];

        for (let i = 0; i < chunks.length; i += CONCURRENCY) {
            const batch = chunks.slice(i, i + CONCURRENCY);

            const batchResults = await Promise.all(
                batch.map(async (chunk) => {
                    const response = await axios.post(`${OLLAMA_URL}/api/embeddings`, {
                        model: EMBEDDING_MODEL,
                        prompt: chunk
                    });

                    return response.data.embedding;
                })
            );

            allEmbeddings.push(...batchResults);

            if (i + CONCURRENCY < chunks.length) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        return allEmbeddings;

    } catch (error) {
        console.error("Error embedding chunks:", error);
        throw new Error("Failed to embed text chunks");
    }
};


/**
 * Chat completion using local Ollama model
 */
export const getChatCompletion = async (
    message: string,
    context: string,
    history: { role: string; content: string }[]
) => {

    const systemPrompt = `
You are PdfChat AI, a helpful assistant created by Rushikesh Patil.

RULES:
1. Answer using the DOCUMENT CONTEXT first.
2. If the answer is not present, say you cannot find it.
3. Do not hallucinate.
`;

    const prompt = `
DOCUMENT CONTEXT:
${context}

QUESTION:
${message}
`;

    const messages = [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: prompt }
    ];

    try {
        const response = await axios.post(`${OLLAMA_URL}/api/chat`, {
            model: CHAT_MODEL,
            messages,
            stream: false
        });

        return response.data.message.content;

    } catch (error) {
        console.error("Chat completion error:", error);
        throw new Error("Ollama chat completion failed");
    }
};