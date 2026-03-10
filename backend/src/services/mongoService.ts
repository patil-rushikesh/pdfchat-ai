import { ChatModel, IChat, IMessage, IChatDocument } from '../models/chatModel';
import { nextSeq } from '../models/counterModel';

// ---------------------------------------------------------------------------
// Chat ID generation  (atomic — no race conditions)
// ---------------------------------------------------------------------------

/**
 * Generate the next sequential chat_id ("chat_1", "chat_2", …).
 *
 * Uses a dedicated MongoDB counters document and $inc so that concurrent
 * requests can never receive the same ID.  The operation is atomic at the
 * MongoDB document level.
 */
export const generateNextChatId = async (): Promise<string> => {
  const seq = await nextSeq('chat_id');
  return `chat_${seq}`;
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new chat session in MongoDB and return it.
 */
export const createChat = async (params: {
  user_id?: string | null;
  title?: string;
}): Promise<IChat> => {
  const chat_id = await generateNextChatId();

  const chat = new ChatModel({
    chat_id,
    user_id: params.user_id ?? null,
    title: params.title || 'New Chat',
    messages: [],
    documents: [],
  });

  return chat.save();
};

/**
 * Fetch a chat session by its chat_id string (e.g. "chat_23").
 */
export const getChatById = async (chatId: string): Promise<IChat | null> => {
  return ChatModel.findOne({ chat_id: chatId });
};

// ---------------------------------------------------------------------------
// Paginated list helpers
// ---------------------------------------------------------------------------

export interface ChatListPage {
  chats: Array<{
    chat_id:    string;
    title:      string;
    created_at: Date;
    updated_at: Date;
    message_count: number;
    document_count: number;
  }>;
  total:    number;
  page:     number;
  limit:    number;
  has_more: boolean;
}

/**
 * Return a paginated list of chat sessions for a user.
 * Only metadata is returned — messages are excluded for performance.
 *
 * @param userId  - The user whose chats to list
 * @param page    - 1-based page number (default 1)
 * @param limit   - Items per page (default 20, max 100)
 * @param sortBy  - Field to sort by: 'updated_at' | 'created_at' (default 'updated_at')
 */
export const getChatListByUserId = async (
  userId: string,
  page  = 1,
  limit = 20,
  sortBy: 'updated_at' | 'created_at' = 'updated_at'
): Promise<ChatListPage> => {
  const safePage  = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip      = (safePage - 1) * safeLimit;

  const filter = { user_id: userId };
  const sort   = { [sortBy]: -1 as const };

  // Run count and data fetch in parallel
  const [total, docs] = await Promise.all([
    ChatModel.countDocuments(filter),
    ChatModel.find(filter, {
      chat_id:   1,
      title:     1,
      created_at: 1,
      updated_at: 1,
      // Include array lengths without transferring full arrays
      messages:  { $slice: 0 },
      documents: { $slice: 0 },
    })
      .sort(sort)
      .skip(skip)
      .limit(safeLimit)
      .lean(),
  ]);

  const chats = docs.map((d: any) => ({
    chat_id:        d.chat_id        as string,
    title:          d.title          as string,
    created_at:     d.created_at     as Date,
    updated_at:     d.updated_at     as Date,
    message_count:  (d.messages  as unknown[])?.length ?? 0,
    document_count: (d.documents as unknown[])?.length ?? 0,
  }));

  return {
    chats,
    total,
    page:     safePage,
    limit:    safeLimit,
    has_more: skip + chats.length < total,
  };
};

/**
 * Fetch all chats for a given user, newest first (unpaginated — kept for
 * internal use; prefer getChatListByUserId for API endpoints).
 */
export const getChatsByUserId = async (userId: string): Promise<IChat[]> => {
  return ChatModel.find({ user_id: userId }, { messages: 0 }).sort({
    updated_at: -1,
  });
};

// ---------------------------------------------------------------------------
// Paginated message fetch
// ---------------------------------------------------------------------------

export interface MessagePage {
  chat_id:    string;
  title:      string;
  user_id:    string | null;
  created_at: Date;
  updated_at: Date;
  documents:  IChatDocument[];
  messages:   IMessage[];
  total_messages: number;
  page:     number;
  limit:    number;
  has_more: boolean;
}

/**
 * Fetch a chat session with its messages paginated.
 * Messages are ordered oldest-first within the page.
 *
 * @param chatId - The chat_id string (e.g. "chat_23")
 * @param page   - 1-based page number (default 1)
 * @param limit  - Messages per page (default 50, max 200)
 */
export const getChatWithMessages = async (
  chatId: string,
  page  = 1,
  limit = 50
): Promise<MessagePage | null> => {
  const safePage  = Math.max(1, page);
  const safeLimit = Math.min(200, Math.max(1, limit));
  const skip      = (safePage - 1) * safeLimit;

  // Fetch metadata + total message count in one lean query
  const meta = await ChatModel.findOne(
    { chat_id: chatId },
    { messages: 0 }
  ).lean();

  if (!meta) return null;

  // Fetch only the requested slice of messages using $slice
  const slice = await ChatModel.findOne(
    { chat_id: chatId },
    { messages: { $slice: [skip, safeLimit] } }
  ).lean();

  // Get total message count via a separate fast aggregation
  const countRes = await ChatModel.aggregate([
    { $match: { chat_id: chatId } },
    { $project: { count: { $size: '$messages' } } },
  ]);
  const totalMessages: number = countRes[0]?.count ?? 0;

  const messages = (slice?.messages ?? []) as IMessage[];

  return {
    chat_id:    meta.chat_id as string,
    title:      meta.title   as string,
    user_id:    meta.user_id as string | null,
    created_at: meta.created_at as Date,
    updated_at: meta.updated_at as Date,
    documents:  meta.documents  as IChatDocument[],
    messages,
    total_messages: totalMessages,
    page:     safePage,
    limit:    safeLimit,
    has_more: skip + messages.length < totalMessages,
  };
};

/**
 * Append a message to an existing chat session.
 */
export const appendMessage = async (
  chatId: string,
  message: Omit<IMessage, 'timestamp'>
): Promise<IChat | null> => {
  return ChatModel.findOneAndUpdate(
    { chat_id: chatId },
    {
      $push: { messages: { ...message, timestamp: new Date() } },
      $set: { updated_at: new Date() },
    },
    { new: true }
  );
};

/**
 * Attach a document reference to a chat session.
 * Call this after storing metadata in PostgreSQL and the file in S3.
 */
export const attachDocumentToChat = async (
  chatId: string,
  doc: IChatDocument
): Promise<IChat | null> => {
  return ChatModel.findOneAndUpdate(
    { chat_id: chatId },
    {
      $addToSet: { documents: doc },
      $set: { updated_at: new Date() },
    },
    { new: true }
  );
};

/**
 * Return only the messages array for a chat (lightweight history fetch).
 */
export const getChatHistory = async (
  chatId: string
): Promise<IMessage[]> => {
  const chat = await ChatModel.findOne(
    { chat_id: chatId },
    { messages: 1 }
  ).lean();
  return (chat?.messages as IMessage[]) ?? [];
};

/**
 * Update the title of a chat session.
 */
export const updateChatTitle = async (
  chatId: string,
  title: string
): Promise<IChat | null> => {
  return ChatModel.findOneAndUpdate(
    { chat_id: chatId },
    { $set: { title, updated_at: new Date() } },
    { new: true }
  );
};

/**
 * Delete a chat session and all its messages.
 */
export const deleteChat = async (chatId: string): Promise<void> => {
  await ChatModel.deleteOne({ chat_id: chatId });
};

/**
 * Atomically append a user message and the corresponding assistant reply in a
 * single MongoDB write.  Using $push.$each keeps the operation atomic so the
 * chat document never contains an unanswered user turn.
 */
export const appendMessagePair = async (
  chatId: string,
  userContent: string,
  assistantContent: string
): Promise<IChat | null> => {
  const now = new Date();
  const userMsg: IMessage = { role: 'user',      content: userContent,      timestamp: now };
  const aiMsg:   IMessage = { role: 'assistant', content: assistantContent, timestamp: new Date() };

  return ChatModel.findOneAndUpdate(
    { chat_id: chatId },
    {
      $push: { messages: { $each: [userMsg, aiMsg] } },
      $set:  { updated_at: new Date() },
    },
    { new: true }
  );
};
