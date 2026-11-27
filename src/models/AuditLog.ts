import mongoose, { Schema, Model } from "mongoose";

export interface IAuditLogDoc {
  _id: mongoose.Types.ObjectId;
  /** The user's ID, or "system" for something the platform did itself. */
  actorId: string;
  actorRole: string;
  /** A dotted name such as `withdrawal.approve` or `user.role_change`. */
  action: string;
  targetType: string;
  targetId: string;
  /** Only the fields that changed. */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLogDoc>(
  {
    actorId: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    reason: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false, collection: "audit_logs" },
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

/**
 * The log is append-only. The real guarantee is the database role in
 * `scripts/mongo-audit-role.js` (insert and find only); these hooks make the
 * application refuse to try, so a mistake fails loudly in tests and in code review.
 */
const FORBIDDEN = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
] as const;
for (const op of FORBIDDEN) {
  AuditLogSchema.pre(op as "updateOne", function () {
    throw new Error(`audit_logs is append-only: ${op} is not allowed`);
  });
}
AuditLogSchema.pre("save", function () {
  if (!this.isNew) throw new Error("audit_logs is append-only: a saved entry cannot be changed");
});

const AuditLog: Model<IAuditLogDoc> =
  mongoose.models.AuditLog || mongoose.model<IAuditLogDoc>("AuditLog", AuditLogSchema);

export default AuditLog;
