/**
 * uploadApi.ts
 *
 * File upload and document presigned URL utilities.
 */

import axios from 'axios';
import { authHeader } from './authApi';

const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3001';

const apiClient = axios.create({ baseURL: `${API_BASE_URL}/api` });

// Attach the JWT on every outgoing request
apiClient.interceptors.request.use(async (config) => {
  const header = await authHeader();
  if (header) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = header;
  }
  return config;
});

/**
 * Upload a PDF file to a specific chat session.
 * Pinecone indexing happens asynchronously on the server after this returns.
 *
 * @param chatId      The target chat session ID
 * @param file        The PDF file to upload
 * @param onProgress  Optional callback for upload progress (0–100)
 */
export const uploadFileToChatSession = async (
  chatId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ document: { id: string; name: string; chat_id: string } }> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiClient.post(`/chat/${chatId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (evt.total && onProgress) {
        onProgress(Math.round((evt.loaded * 100) / evt.total));
      }
    },
  });
  return res.data;
};

/**
 * Fetch a short-lived presigned S3 URL for downloading a document's original PDF.
 */
export const getDocumentSignedUrl = async (
  chatId: string,
  docId: string
): Promise<{ url: string; expires_in: number; expires_at: string }> => {
  const res = await apiClient.get(`/chat/${chatId}/documents/${docId}/signed-url`);
  return res.data;
};
