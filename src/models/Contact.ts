import mongoose, { Schema, Document, Model } from "mongoose";

export interface IContactDoc extends Document {
  name: string;
  email: string;
  subject: string;
  message: string;
  category?: string;
  createdAt: Date;
}

const ContactSchema = new Schema<IContactDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    category: { type: String },
  },
  { timestamps: true },
);

const Contact: Model<IContactDoc> =
  mongoose.models.Contact ||
  mongoose.model<IContactDoc>("Contact", ContactSchema);

export default Contact;