import mongoose, { Schema, model, Document, Model } from 'mongoose';

// ---------------------------------------------------------------------------
// Sub-document interfaces
// ---------------------------------------------------------------------------

export interface IMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IChatDocument {
  document_id: string;   // UUID from the SQL documents table
  file_name: string;
  s3_url: string;
}

// ---------------------------------------------------------------------------
// Main chat session interface
// ---------------------------------------------------------------------------

export interface IChat extends Document {
  chat_id: string;          // e.g. "chat_1", "chat_2"
  user_id: string | null;
  title: string;
  created_at: Date;
  updated_at: Date;
  messages: IMessage[];
  documents: IChatDocument[];
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const MessageSchema = new Schema<IMessage>(
  {
    role:      { type: String, enum: ['user', 'assistant'], required: true },
    content:   { type: String, required: true },
    timestamp: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const ChatDocumentSchema = new Schema<IChatDocument>(
  {
    document_id: { type: String, required: true },
    file_name:   { type: String, required: true },
    s3_url:      { type: String, required: true },
  },
  { _id: false }
);

const ChatSchema = new Schema<IChat>(
  {
    chat_id:    { type: String, required: true, unique: true, index: true },
    user_id:    { type: String, default: null, index: true },
    title:      { type: String, default: 'New Chat' },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
    messages:   { type: [MessageSchema], default: [] },
    documents:  { type: [ChatDocumentSchema], default: [] },
  },
  {
    collection: 'chats',
    versionKey: false,
  }
);

// ---------------------------------------------------------------------------
// Indexes for fast paginated queries
// ---------------------------------------------------------------------------

// List user chats sorted by most-recently updated
ChatSchema.index({ user_id: 1, updated_at: -1 });
// List user chats sorted by creation time
ChatSchema.index({ user_id: 1, created_at: -1 });

// Keep updated_at current automatically
ChatSchema.pre('save', async function () {
  this.updated_at = new Date();
});

ChatSchema.pre('findOneAndUpdate', async function () {
  this.set({ updated_at: new Date() });
});

// ---------------------------------------------------------------------------
// Model  (safe for hot-reload — re-uses existing model if already compiled)
// ---------------------------------------------------------------------------

export const ChatModel: Model<IChat> =
  (mongoose.models['Chat'] as Model<IChat>) || model<IChat>('Chat', ChatSchema);
