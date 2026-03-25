import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUserDoc extends Document {
  name: string;
  email: string;
  passwordHash?: string;
  photoUrl?: string;
  about?: string;
  role: "worker" | "buyer" | "admin";
  coins: number;
  status: "active" | "suspended";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String },
    photoUrl: { type: String },
    about: { type: String },
    role: {
      type: String,
      enum: ["worker", "buyer", "admin"],
      default: "worker",
    },
    coins: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
  },
  { timestamps: true },
);

const User: Model<IUserDoc> =
  mongoose.models.User || mongoose.model<IUserDoc>("User", UserSchema);

export default User;
