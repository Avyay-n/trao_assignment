import mongoose, { Schema, Document } from "mongoose";
import { Kit } from "@prepkit/core";
import { memoryStore, isUsingMemoryStore } from "./store.js";

export interface IMockInterviewAttempt {
  id: string;
  questionId: string;
  questionPrompt: string;
  userAnswer: string;
  overallScore: number;
  criteriaScores: {
    technicalAccuracy: number;
    structureAndClarity: number;
    starFramework: number;
  };
  strengths: string[];
  weakSpots: string[];
  recommendedImprovements: string;
  evaluatedAt: string;
}

export interface IKitDocument extends Document {
  userId: any;
  title: string;
  company: string;
  company_url: string;
  days: number;
  jd: string;
  status: "generating" | "ready" | "failed";
  progress: number;
  progressMessage: string;
  error?: string;
  kitData?: Kit;
  flashcardConfidence: Record<string, number>;
  mockInterviews: IMockInterviewAttempt[];
  createdAt: Date;
  updatedAt: Date;
}

const MockInterviewAttemptSchema = new Schema({
  id: { type: String, required: true },
  questionId: { type: String, required: true },
  questionPrompt: { type: String, required: true },
  userAnswer: { type: String, required: true },
  overallScore: { type: Number, required: true },
  criteriaScores: {
    technicalAccuracy: { type: Number, required: true },
    structureAndClarity: { type: Number, required: true },
    starFramework: { type: Number, required: true },
  },
  strengths: [{ type: String }],
  weakSpots: [{ type: String }],
  recommendedImprovements: { type: String },
  evaluatedAt: { type: String, required: true },
});

const KitDocumentSchema = new Schema<IKitDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    company_url: { type: String, required: true },
    days: { type: Number, required: true, min: 1 },
    jd: { type: String, required: true },
    status: {
      type: String,
      enum: ["generating", "ready", "failed"],
      default: "generating",
      index: true,
    },
    progress: { type: Number, default: 0 },
    progressMessage: { type: String, default: "Queued for generation" },
    error: { type: String },
    kitData: { type: Schema.Types.Mixed },
    flashcardConfidence: { type: Schema.Types.Mixed, default: {} },
    mockInterviews: [MockInterviewAttemptSchema],
  },
  { timestamps: true }
);

export const MongoKitModel = mongoose.models.Kit || mongoose.model<IKitDocument>("Kit", KitDocumentSchema);

export const KitModel = {
  async create(data: any): Promise<any> {
    if (isUsingMemoryStore) {
      return memoryStore.createKit(data);
    }
    return MongoKitModel.create(data);
  },

  async findOne(query: { _id?: string; userId?: any }): Promise<any> {
    if (isUsingMemoryStore) {
      return memoryStore.findKitOne(query);
    }
    return MongoKitModel.findOne(query);
  },

  async findById(id: string): Promise<any> {
    if (isUsingMemoryStore) {
      return memoryStore.findKitOne({ _id: id });
    }
    return MongoKitModel.findById(id);
  },

  async findByIdAndUpdate(id: string, updates: any): Promise<any> {
    if (isUsingMemoryStore) {
      return memoryStore.updateKit(id, updates);
    }
    return MongoKitModel.findByIdAndUpdate(id, updates);
  },

  find(query: { userId?: any }): any {
    if (isUsingMemoryStore) {
      return {
        sort: (_sortObj: any) => ({
          select: async (_fields?: string) => {
            return memoryStore.findKits(query);
          },
        }),
      };
    }
    return MongoKitModel.find(query);
  },

  async deleteOne(query: { _id?: string; userId?: any }): Promise<any> {
    if (isUsingMemoryStore) {
      return memoryStore.deleteKit(query);
    }
    return MongoKitModel.deleteOne(query);
  },
};
