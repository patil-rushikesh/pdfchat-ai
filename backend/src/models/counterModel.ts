/**
 * Atomic sequence counter collection.
 *
 * Each document tracks the current sequence value for a named counter.
 * MongoDB's findOneAndUpdate with $inc is atomic at the document level,
 * making this safe under any level of concurrency with no application-level
 * locking required.
 *
 * Example document:
 *   { _id: "chat_id", seq: 42 }
 */

import mongoose, { Schema, model, Model } from 'mongoose';

export interface ICounter {
  _id: string;   // counter name, e.g. "chat_id"
  seq: number;   // current value (last value handed out)
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { collection: 'counters', versionKey: false }
);

export const CounterModel: Model<ICounter> =
  (mongoose.models['Counter'] as Model<ICounter>) ||
  model<ICounter>('Counter', CounterSchema);

/**
 * Atomically increment the named counter and return the new value.
 * If the counter does not exist yet it is created starting at 1.
 */
export const nextSeq = async (counterName: string): Promise<number> => {
  const doc = await CounterModel.findOneAndUpdate(
    { _id: counterName },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  if (!doc) throw new Error(`Failed to increment counter: ${counterName}`);
  return doc.seq;
};
