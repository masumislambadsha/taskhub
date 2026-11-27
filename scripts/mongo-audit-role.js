// Gives the application a MongoDB user that can only add and read audit entries.
//
// Run once per environment with mongosh, as a user allowed to create roles:
//   mongosh "$ADMIN_MONGODB_URI" --eval 'const DB="taskhub", APP_USER="taskhub_app", APP_PASS="..."' scripts/mongo-audit-role.js
//
// The application connects as APP_USER. It can do its normal work on every
// other collection, but on `audit_logs` it can only insert and find, so even
// a bug or a stolen app credential cannot edit or erase the log.
const dbName = typeof DB !== "undefined" ? DB : "taskhub";
const appDb = db.getSiblingDB(dbName);

appDb.createRole({
  name: "auditLogAppendOnly",
  privileges: [
    { resource: { db: dbName, collection: "audit_logs" }, actions: ["insert", "find", "createIndex"] },
  ],
  roles: [],
});

// Everything except audit_logs: read and write on the other collections.
const others = appDb
  .getCollectionNames()
  .filter((c) => c !== "audit_logs" && !c.startsWith("system."))
  .map((c) => ({
    resource: { db: dbName, collection: c },
    actions: ["find", "insert", "update", "remove", "createIndex", "collStats"],
  }));
appDb.createRole({ name: "taskhubApp", privileges: others, roles: [] });

appDb.createUser({
  user: typeof APP_USER !== "undefined" ? APP_USER : "taskhub_app",
  pwd: typeof APP_PASS !== "undefined" ? APP_PASS : passwordPrompt(),
  roles: [{ role: "taskhubApp", db: dbName }, { role: "auditLogAppendOnly", db: dbName }],
});
print(`created roles and user on ${dbName}. MongoDB privileges only add up, so the built-in readWrite role cannot be used (it would allow changing audit_logs); a collection created later must be added to taskhubApp.`);
