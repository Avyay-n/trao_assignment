import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { generateToken, AuthRequest } from "../middleware/auth.js";

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: "Name, email, and password are required." });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ error: "An account with this email address already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
    });

    const token = generateToken(user._id.toString(), user.email);
    res.status(201).json({
      user: { id: user._id, email: user.email, name: user.name },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Registration failed." });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const token = generateToken(user._id.toString(), user.email);
    res.json({
      user: { id: user._id, email: user.email, name: user.name },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Login failed." });
  }
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    const rawUser = await User.findById(req.userId);
    if (!rawUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const { passwordHash, ...user } = rawUser.toObject ? rawUser.toObject() : rawUser;
    res.json({ user });
    return;
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Convenient demo login endpoint for rapid assessment testing.
 */
export async function demoLogin(_req: Request, res: Response): Promise<void> {
  try {
    const demoEmail = "demo@trao-prepkit.internal";
    let user = await User.findOne({ email: demoEmail });

    if (!user) {
      const passwordHash = await bcrypt.hash("demo12345", 10);
      user = await User.create({
        email: demoEmail,
        passwordHash,
        name: "Trao Reviewer",
      });
    }

    const token = generateToken(user._id.toString(), user.email);
    res.json({
      user: { id: user._id, email: user.email, name: user.name },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
