import mongoose from "mongoose";
import { Kit } from "@prepkit/core";

// Simple in-memory/JSON persistence fallback if MongoDB is not running
interface StoredUser {
  _id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

interface StoredKit {
  _id: string;
  userId: string;
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
  mockInterviews: any[];
  createdAt: Date;
  updatedAt: Date;
  save: () => Promise<StoredKit>;
  markModified: (field: string) => void;
}

class MemoryStore {
  users: Map<string, StoredUser> = new Map();
  kits: Map<string, StoredKit> = new Map();
  private userCounter = 1;
  private kitCounter = 1;

  // User methods
  async findUserOne(query: { email?: string; _id?: string }): Promise<StoredUser | null> {
    for (const user of this.users.values()) {
      if (query.email && user.email.toLowerCase() === query.email.toLowerCase()) {
        return user;
      }
      if (query._id && user._id === query._id) {
        return user;
      }
    }
    return null;
  }

  async createUser(data: { email: string; passwordHash: string; name: string }): Promise<StoredUser> {
    const id = new mongoose.Types.ObjectId().toString();
    const user: StoredUser = {
      _id: id,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      name: data.name,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  // Kit methods
  async createKit(data: any): Promise<StoredKit> {
    const id = new mongoose.Types.ObjectId().toString();
    const store = this;

    const kit: StoredKit = {
      _id: id,
      userId: data.userId?.toString() || data.userId,
      title: data.title,
      company: data.company,
      company_url: data.company_url,
      days: data.days,
      jd: data.jd,
      status: data.status || "generating",
      progress: data.progress || 0,
      progressMessage: data.progressMessage || "Queued",
      error: data.error,
      kitData: data.kitData,
      flashcardConfidence: data.flashcardConfidence || {},
      mockInterviews: data.mockInterviews || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      async save() {
        kit.updatedAt = new Date();
        store.kits.set(id, kit);
        return kit;
      },
      markModified(_field: string) {},
    };

    this.kits.set(id, kit);
    return kit;
  }

  async findKitOne(query: { _id?: string; userId?: string }): Promise<StoredKit | null> {
    const kit = this.kits.get(query._id || "");
    if (!kit) return null;
    if (query.userId && kit.userId !== query.userId.toString()) return null;
    return kit;
  }

  async findKits(query: { userId?: string }): Promise<StoredKit[]> {
    const result: StoredKit[] = [];
    for (const kit of this.kits.values()) {
      if (!query.userId || kit.userId === query.userId.toString()) {
        result.push(kit);
      }
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateKit(id: string, updates: any): Promise<StoredKit | null> {
    const kit = this.kits.get(id);
    if (!kit) return null;
    Object.assign(kit, updates);
    kit.updatedAt = new Date();
    this.kits.set(id, kit);
    return kit;
  }

  async deleteKit(query: { _id?: string; userId?: string }): Promise<{ deletedCount: number }> {
    const kit = this.kits.get(query._id || "");
    if (!kit) return { deletedCount: 0 };
    if (query.userId && kit.userId !== query.userId.toString()) return { deletedCount: 0 };
    this.kits.delete(query._id || "");
    return { deletedCount: 1 };
  }
}

export const memoryStore = new MemoryStore();
export let isUsingMemoryStore = true;

export function setUsingMemoryStore(val: boolean) {
  isUsingMemoryStore = val;
}
