import { MongoClient, type Db } from "mongodb";
import type {
  ActivityDoc,
  BoardDoc,
  JournalDoc,
  TaskDoc,
  UserDoc,
  ChangeDoc,
  ConnectionDoc,
  SyncJobDoc,
  SyncMapDoc,
  OAuthStateDoc,
  PushDoc,
  PreferenceDoc,
  FocusDoc,
} from "./types";

const uri = process.env.MONGODB_URI ?? "mongodb://localhost:27017";
const dbName = process.env.MONGODB_DB ?? "kanban";

const client = new MongoClient(uri);
let db: Db | null = null;

export async function connect() {
  if (db) return db;
  await client.connect();
  db = client.db(dbName);
  await Promise.all([
    collections().oauthStates.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    ),
    collections().focus.createIndex(
      { userId: 1 },
      { unique: true, partialFilterExpression: { endedAt: null } },
    ),
    collections().history.createIndex({ userId: 1, at: -1 }),
    collections().connections.createIndex(
      { userId: 1, service: 1 },
      { unique: true },
    ),
    collections().push.createIndex({ endpoint: 1 }, { unique: true }),
    collections().tasks.createIndex({ userId: 1, boardId: 1, position: 1 }),
    collections().activity.createIndex({ userId: 1, boardId: 1, at: -1 }),
    collections().boards.createIndex({ userId: 1, position: 1 }),
    collections().journal.createIndex({ userId: 1, day: -1 }),
    collections().users.createIndex({ calendarToken: 1 }, { unique: true }),
  ]);
  return db;
}

export function collections() {
  if (!db) throw new Error("Database not connected");
  return {
    history: db.collection<ChangeDoc>("changes"),
    connections: db.collection<ConnectionDoc>("connections"),
    syncJobs: db.collection<SyncJobDoc>("syncJobs"),
    syncMaps: db.collection<SyncMapDoc>("syncMaps"),
    oauthStates: db.collection<OAuthStateDoc>("oauthStates"),
    push: db.collection<PushDoc>("push"),
    preferences: db.collection<PreferenceDoc>("preferences"),
    focus: db.collection<FocusDoc>("focus"),
    boards: db.collection<BoardDoc>("boards"),
    tasks: db.collection<TaskDoc>("tasks"),
    activity: db.collection<ActivityDoc>("activity"),
    journal: db.collection<JournalDoc>("journal"),
    users: db.collection<UserDoc>("users"),
  };
}
