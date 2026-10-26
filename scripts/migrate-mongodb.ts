import { MongoClient, BSON } from "../backend/node_modules/mongodb";
import { mkdir, writeFile } from "node:fs/promises";
const { EJSON } = BSON;

// Credentials are read from the environment, never accepted as CLI arguments or logged.
const sourceUri = process.env.SOURCE_MONGODB_URI;
const targetUri = process.env.TARGET_MONGODB_URI;
const database = process.env.MONGODB_DB ?? "kanban";
if (!sourceUri || !targetUri)
  throw new Error("Set SOURCE_MONGODB_URI and TARGET_MONGODB_URI");
if (sourceUri === targetUri)
  throw new Error("Source and target must be different databases");
const source = new MongoClient(sourceUri),
  target = new MongoClient(targetUri);
try {
  await Promise.all([source.connect(), target.connect()]);
  const folder = `backups/mongodb-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await mkdir(folder, { recursive: true, mode: 0o700 });
  for (const { name } of await source
    .db(database)
    .listCollections()
    .toArray()) {
    if (name.startsWith("system.") || name === "oauthStates") continue;
    const documents = await source
      .db(database)
      .collection(name)
      .find()
      .toArray();
    await writeFile(`${folder}/${name}.json`, EJSON.stringify(documents), {
      mode: 0o600,
    });
    if (documents.length)
      await target
        .db(database)
        .collection(name)
        .bulkWrite(
          documents.map((doc) => ({
            replaceOne: {
              filter: { _id: doc._id },
              replacement: doc,
              upsert: true,
            },
          })),
        );
    console.log(`${name}: migrated ${documents.length} records`);
  }
  console.log(
    "Migration complete; the local source was preserved. Private backup is in backups/.",
  );
} finally {
  await Promise.all([source.close(), target.close()]);
}
