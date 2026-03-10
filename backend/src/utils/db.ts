/**
 * Legacy JSON-file chat history helpers.
 *
 * These are preserved for local/development use when neither PostgreSQL nor
 * MongoDB is configured.  New code should use:
 *   - src/services/mongoService.ts  — for chat conversations (MongoDB)
 *   - src/models/documentModel.ts  — for document metadata (PostgreSQL)
 */
import fs from 'fs/promises';
import path from 'path';

// Define the structure of a message and a conversation
export interface ChatMessage {
    messageId: string;
    role: 'user' | 'model';
    text: string;
    timestamp: string;
    feedback?: 'like' | 'dislike';
    sources?: Array<{ pageNumber: number; textSnippet: string }>;
}

export type Conversation = ChatMessage[];

// Path to our JSON database file
const dbPath = path.join(process.cwd(), 'chat_logs.json');

// Reads the entire chat database from the JSON file
export const readChatDatabase = async (): Promise<Record<string, Conversation>> => {
    try {
        const fileContent = await fs.readFile(dbPath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
};

// Writes the entire chat database to the JSON file (dev fallback only)
export const writeChatDatabase = async (data: Record<string, Conversation>): Promise<void> => {
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf-8');
};
