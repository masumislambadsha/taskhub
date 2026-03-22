import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICategoryDoc extends Document {
  name: string;
  icon: string;
  createdAt: Date;
}

const CategorySchema = new Schema<ICategoryDoc>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    icon: { type: String, default: "category" },
  },
  { timestamps: true },
);

const Category: Model<ICategoryDoc> =
  mongoose.models.Category ||
  mongoose.model<ICategoryDoc>("Category", CategorySchema);

export default Category;
