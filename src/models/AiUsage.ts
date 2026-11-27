import mongoose, { Schema, Model } from "mongoose";

export interface IAiUsageDoc {
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  ms: number;
  /** Estimated from the token counts and AI_PRICE_*_PER_MTOK (0 when no prices are configured). */
  costUsd: number;
  verdict?: string;
  submissionId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const AiUsageSchema = new Schema<IAiUsageDoc>(
  {
    feature: { type: String, required: true },
    model: { type: String, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cacheReadTokens: { type: Number, default: 0 },
    ms: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    verdict: { type: String },
    submissionId: { type: Schema.Types.ObjectId },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "ai_usage", versionKey: false },
);
AiUsageSchema.index({ createdAt: -1 });
AiUsageSchema.index({ feature: 1, createdAt: -1 });

const AiUsage: Model<IAiUsageDoc> = mongoose.models.AiUsage || mongoose.model<IAiUsageDoc>("AiUsage", AiUsageSchema);
export default AiUsage;
