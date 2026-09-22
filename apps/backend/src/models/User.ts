import mongoose, { Schema, Document } from "mongoose";
import { memoryStore, isUsingMemoryStore } from "./store.js";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const MongoUserModel = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export const User = {
  async findOne(query: { email?: string; _id?: string }): Promise<any> {
    if (isUsingMemoryStore) {
      return memoryStore.findUserOne(query);
    }
    return MongoUserModel.findOne(query);
  },

  async findById(id: string): Promise<any> {
    if (isUsingMemoryStore) {
      const user = await memoryStore.findUserOne({ _id: id });
      if (!user) return null;
      return {
        ...user,
        select: (_fields: string) => user,
      };
    }
    return MongoUserModel.findById(id);
  },

  async create(data: { email: string; passwordHash: string; name: string }): Promise<any> {
    if (isUsingMemoryStore) {
      return memoryStore.createUser(data);
    }
    return MongoUserModel.create(data);
  },
};
