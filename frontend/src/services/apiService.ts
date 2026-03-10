/**
 * apiService.ts — Re-export barrel for all API modules.
 *
 * Existing code that uses `import * as apiService from './apiService'`
 * continues to work without changes.
 *
 * For new code, prefer direct imports for cleaner dependency tracking:
 *   import { getUserId, getAuthToken } from './authApi';
 *   import { createChatSession, sendSessionMessage } from './chatApi';
 *   import { uploadFileToChatSession } from './uploadApi';
 */
export * from './authApi';
export * from './chatApi';
export * from './uploadApi';
