import { auth } from '../auth/firebase';

/** Returns the signed-in Firebase UID used to scope chats, PDFs, and history. */
export const getUserId = (): string => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('You must be signed in to use PdfChat.');
  }
  return uid;
};

/** Returns a Firebase ID token for backend verification. */
export const getAuthToken = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to use PdfChat.');
  }
  return user.getIdToken();
};

/** Returns the Authorization Bearer header value, or empty string on failure. */
export const authHeader = async (): Promise<string> => {
  try {
    const token = await getAuthToken();
    return `Bearer ${token}`;
  } catch {
    return '';
  }
};
