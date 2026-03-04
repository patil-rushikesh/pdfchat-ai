import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    Content,
} from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("⚠️  GEMINI_API_KEY is not set. Gemini features will be disabled.");
}

let ai: GoogleGenerativeAI | null = null;

if (API_KEY) {
    try {
        ai = new GoogleGenerativeAI(API_KEY);
        console.log("✅ Gemini AI initialized successfully");
    } catch (error) {
        console.error("❌ Failed to initialize Gemini AI:", error);
        ai = null;
    }
}

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const generationConfig = {
    temperature: 0.7,
    topK: 1,
    topP: 1,
};

// text-embedding-004 was deprecated Jan 14, 2026. Use gemini-embedding-001.
const EMBEDDING_MODEL = "gemini-embedding-001";

/**
 * Generates a single embedding for a given text.
 */
export const getEmbeddings = async (text: string): Promise<number[]> => {
    if (!ai) throw new Error("Gemini AI is not initialized. Please set GEMINI_API_KEY.");

    try {
        const model = ai.getGenerativeModel({ model: EMBEDDING_MODEL });
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error("Error getting embeddings:", error);
        throw new Error("Failed to generate embeddings");
    }
};

/**
 * Generates embeddings for an array of text chunks.
 * Note: gemini-embedding-001 only supports one input text per request.
 */
export const embedChunks = async (chunks: string[]): Promise<number[][]> => {
    if (!ai) throw new Error("Gemini AI is not initialized. Please set GEMINI_API_KEY.");

    try {
        const model = ai.getGenerativeModel({ model: EMBEDDING_MODEL });

        // gemini-embedding-001 supports one input per request — batch with concurrency limit
        const CONCURRENCY = 5;
        const allEmbeddings: number[][] = [];

        for (let i = 0; i < chunks.length; i += CONCURRENCY) {
            const batch = chunks.slice(i, i + CONCURRENCY);

            const batchResults = await Promise.all(
                batch.map(async (chunk) => {
                    const result = await model.embedContent(chunk);
                    return result.embedding.values;
                })
            );

            allEmbeddings.push(...batchResults.filter(v => v.length > 0));

            // Delay between batches to respect rate limits
            if (i + CONCURRENCY < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        return allEmbeddings;
    } catch (error) {
        console.error("Error embedding chunks:", error);
        throw new Error("Failed to embed text chunks");
    }
};

/**
 * Generates a streaming chat completion based on a prompt, context, and history.
 */
export const getChatCompletion = async (
    message: string,
    context: string,
    history: Content[],
    userType: 'student' | 'teacher' | 'researcher' | 'general' = 'general'
) => {
    if (!ai) throw new Error("Gemini AI is not initialized. Please set GEMINI_API_KEY.");

    try {
        console.log(`Starting Gemini chat completion for user type: ${userType}`);

        const systemInstruction = `You are PdfChat AI, a warm, emotionally intelligent female assistant created by Rushikesh Patil — an expert AI developer and researcher.

## Core Identity & Purpose
Your primary mission is to help users deeply understand their uploaded documents through intelligent analysis, contextual explanation, and meaningful engagement.

## Response Framework

### 1. Document-First Hierarchy
**Priority 1 - Document Context:**
- ALWAYS prioritize information directly from the uploaded document
- Quote specific sections when relevant (with page/section references if available)
- If the answer exists in the document, derive it ONLY from there
- Never contradict or override document content with external knowledge

**Priority 2 - Contextual Inference:**
- If the exact answer isn't explicit but can be reasonably inferred from document context, state: "Based on the document context, it appears that..."
- Clearly distinguish between what's stated vs. what's inferred

**Priority 3 - General Knowledge (Limited Use):**
- Only for: clarifying terms, providing background context, or answering meta-questions about yourself
- ALWAYS preface with: "While this isn't in your document..." or "Generally speaking..."
- Redirect back to document: "Would you like me to find related information in your document?"

### 2. Handling Missing Information
When the document doesn't contain the answer:
- "I've carefully reviewed your document, and I don't see information about [topic]. The document focuses on [what it actually covers]."
- "This specific detail isn't mentioned in your document. However, I found related information about [X] on page/section [Y]."
- Never make up information or present guesses as facts

### 3. Identity Questions
- Respond warmly: "I'm PdfChat AI — your intelligent document companion created by Rushikesh Patil! 📚✨"

## Critical Rules
- Never hallucinate or fabricate document content
- Never mix external knowledge with document facts without clear distinction
- Always cite specific sections/pages when available`;

        const userTypePrompts: Record<string, string> = {
            student: `You are helping a student. Use simple language, provide examples, and be encouraging.`,
            teacher: `You are helping a teacher. Provide detailed explanations and suggest teaching strategies.`,
            researcher: `You are helping a researcher. Be thorough and suggest further research directions.`,
            general: `You are helping a general user. Be clear, helpful, and engaging.`,
        };

        const promptMessage = `
DOCUMENT CONTEXT:
---
${context}
---

USER QUESTION:
"${message}"

${userTypePrompts[userType] ?? userTypePrompts.general}

Use ONLY the context if it answers the question. If not, use general knowledge *only if* it's a simple/general question.
        `.trim();

        const model = ai.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction,
            generationConfig,
            safetySettings,
        });

        const chat = model.startChat({ history });
        const result = await chat.sendMessageStream(promptMessage);
        console.log('Gemini response stream created successfully');

        return result;
    } catch (error) {
        console.error("Error in Gemini chat completion:", error);
        if (error instanceof Error) {
            throw new Error(`Gemini chat completion failed: ${error.message}`);
        }
        throw new Error("Gemini chat completion failed with unknown error");
    }
};