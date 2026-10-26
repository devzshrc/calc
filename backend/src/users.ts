import { randomBytes } from "node:crypto";
import { collections } from "./db";
import { seedFor } from "./seed";

const known = new Set<string>();

/**
 * First request from a user: create their record, then either adopt data
 * created before sign-in existed (only for the very first account) or seed
 * starter boards.
 */
export async function ensureUser(userId: string) {
  if (known.has(userId)) return;
  const { users, boards, tasks, activity, journal } = collections();
  const existing = await users.findOne({ _id: userId });
  if (!existing) {
    const isFirst = (await users.estimatedDocumentCount()) === 0;
    try {
      await users.insertOne({
        _id: userId,
        calendarToken: randomBytes(24).toString("base64url"),
        createdAt: new Date(),
      });
    } catch (error) {
      // A concurrent first request already created the user.
      if ((error as { code?: number }).code !== 11000) throw error;
      known.add(userId);
      return;
    }
    const legacy = isFirst && (await boards.countDocuments({ userId: { $exists: false } })) > 0;
    if (legacy) {
      const filter = { userId: { $exists: false } };
      await Promise.all([
        boards.updateMany(filter, { $set: { userId } }),
        tasks.updateMany(filter, { $set: { userId } }),
        activity.updateMany(filter, { $set: { userId } }),
      ]);
      const entries = await journal.find({ userId: { $exists: false } }).toArray();
      for (const entry of entries) {
        await journal.deleteOne({ _id: entry._id });
        await journal.insertOne({ ...entry, _id: `${userId}:${entry._id}`, userId, day: entry._id });
      }
    } else {
      await seedFor(userId);
    }
  }
  known.add(userId);
}

export async function userByCalendarToken(token: string) {
  return collections().users.findOne({ calendarToken: token });
}

export async function calendarToken(userId: string) {
  return (await collections().users.findOne({ _id: userId }))?.calendarToken ?? null;
}
