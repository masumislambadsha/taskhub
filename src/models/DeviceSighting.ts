import mongoose, { Schema, Model } from "mongoose";

export interface IDeviceSightingDoc {
  userId: mongoose.Types.ObjectId;
  deviceId: string;
  /** HMAC of the IP with a secret salt: comparable, but not readable. */
  ipHash: string;
  userAgent?: string;
  /** Where it was seen: register, login, submit or withdraw. */
  context: string;
  firstSeen: Date;
  lastSeen: Date;
}

const DeviceSightingSchema = new Schema<IDeviceSightingDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deviceId: { type: String, required: true },
    ipHash: { type: String, required: true },
    userAgent: { type: String },
    context: { type: String, required: true },
    firstSeen: { type: Date, required: true },
    lastSeen: { type: Date, required: true },
  },
  { collection: "device_sightings", versionKey: false },
);

// One row per user and device. "Which accounts use this device?"
DeviceSightingSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
DeviceSightingSchema.index({ deviceId: 1 });
// Signals are kept for 90 days after they were last seen.
DeviceSightingSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

const DeviceSighting: Model<IDeviceSightingDoc> =
  mongoose.models.DeviceSighting || mongoose.model<IDeviceSightingDoc>("DeviceSighting", DeviceSightingSchema);

export default DeviceSighting;
