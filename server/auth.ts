import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db, queryOne } from "./db.js";

export type UserRole = "owner" | "administrator" | "manager" | "viewer";

export type AuthUser = {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}

const cookieName = "dh_session";
const sessionDays = Number(process.env.SESSION_DAYS ?? 14);

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseCookies(header: string | undefined) {
  const cookies = new Map<string, string>();
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (!name || value.length === 0) continue;
    cookies.set(name, decodeURIComponent(value.join("=")));
  }

  return cookies;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(res: Response, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  const tokenHash = hashToken(token);

  await db.query(
    `insert into sessions (id, user_id, token_hash, expires_at)
     values ($1, $2, $3, now() + ($4 || ' days')::interval)`,
    [id, userId, tokenHash, sessionDays]
  );

  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionDays * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

export async function clearSession(req: Request, res: Response) {
  const token = parseCookies(req.headers.cookie).get(cookieName);
  if (token) {
    await db.query("delete from sessions where token_hash = $1", [hashToken(token)]);
  }

  res.clearCookie(cookieName, { path: "/" });
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = parseCookies(req.headers.cookie).get(cookieName);
  if (!token) return next();

  const session = await queryOne<AuthUser & { session_id: string }>(
    `select
       s.id as session_id,
       u.id,
       u.organization_id,
       u.name,
       u.email,
       u.role,
       u.avatar_url
     from sessions s
     join users u on u.id = s.user_id
     where s.token_hash = $1
       and s.expires_at > now()
       and u.active = true`,
    [hashToken(token)]
  );

  if (session) {
    req.sessionId = session.session_id;
    req.user = {
      id: session.id,
      organization_id: session.organization_id,
      name: session.name,
      email: session.email,
      role: session.role,
      avatar_url: session.avatar_url
    };
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }

  next();
}

export function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Permisos insuficientes" });
      return;
    }

    next();
  };
}
