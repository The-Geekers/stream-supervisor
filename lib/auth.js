import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "ss_session";

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function account(username, password, role) {
  const user = String(username || "");
  const pass = String(password || "");
  if (!user || !pass) return null;
  return { username:user, password:pass, role };
}

function tokenHash(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function parseCookie(header, name) {
  if (typeof header !== "string" || !header) return "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

function anonymous(authRequired) {
  return {
    authenticated:false,
    username:null,
    role:"viewer",
    actionsEnabled:false,
    authRequired
  };
}

export function createSessionAuth({
  username,
  password,
  technicianUsername,
  technicianPassword,
  sessionTtlMs = 8 * 60 * 60 * 1000,
  maxSessions = 100
} = {}) {
  const accounts = [
    account(username, password, "admin"),
    account(technicianUsername, technicianPassword, "technician")
  ].filter(Boolean);

  const enabled = accounts.length > 0;
  const ttlMs = Math.max(5 * 60 * 1000, Number(sessionTtlMs) || 8 * 60 * 60 * 1000);
  const sessions = new Map();

  function cleanup(now = Date.now()) {
    for (const [hash, session] of sessions.entries()) {
      if (session.expiresAt <= now) sessions.delete(hash);
    }
    while (sessions.size > maxSessions) {
      const oldest = sessions.keys().next().value;
      if (!oldest) break;
      sessions.delete(oldest);
    }
  }

  function verifyCredentials(candidateUsername, candidatePassword) {
    if (!enabled) return null;
    for (const candidate of accounts) {
      if (
        safeEqual(candidateUsername, candidate.username)
        && safeEqual(candidatePassword, candidate.password)
      ) {
        return candidate;
      }
    }
    return null;
  }

  function login(candidateUsername, candidatePassword) {
    cleanup();
    const candidate = verifyCredentials(candidateUsername, candidatePassword);
    if (!candidate) return null;

    const token = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + ttlMs;
    sessions.set(tokenHash(token), {
      username:candidate.username,
      role:candidate.role,
      expiresAt
    });
    cleanup();

    return {
      token,
      session:{
        authenticated:true,
        username:candidate.username,
        role:candidate.role,
        actionsEnabled:["admin","technician"].includes(candidate.role),
        authRequired:true,
        expiresAt:new Date(expiresAt).toISOString()
      }
    };
  }

  function authenticate(cookieHeader) {
    if (!enabled) return anonymous(false);
    cleanup();

    const token = parseCookie(cookieHeader, COOKIE_NAME);
    if (!token) return anonymous(true);

    const hash = tokenHash(token);
    const stored = sessions.get(hash);
    if (!stored) return anonymous(true);
    if (stored.expiresAt <= Date.now()) {
      sessions.delete(hash);
      return anonymous(true);
    }

    return {
      authenticated:true,
      username:stored.username,
      role:stored.role,
      actionsEnabled:["admin","technician"].includes(stored.role),
      authRequired:true,
      expiresAt:new Date(stored.expiresAt).toISOString()
    };
  }

  function logout(cookieHeader) {
    const token = parseCookie(cookieHeader, COOKIE_NAME);
    if (!token) return false;
    return sessions.delete(tokenHash(token));
  }

  function cookie(token, { secure = false } = {}) {
    const maxAge = Math.floor(ttlMs / 1000);
    return [
      `${COOKIE_NAME}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      `Max-Age=${maxAge}`,
      secure ? "Secure" : ""
    ].filter(Boolean).join("; ");
  }

  function clearCookie({ secure = false } = {}) {
    return [
      `${COOKIE_NAME}=`,
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      "Max-Age=0",
      secure ? "Secure" : ""
    ].filter(Boolean).join("; ");
  }

  return {
    enabled,
    login,
    authenticate,
    logout,
    cookie,
    clearCookie,
    verifyCredentials
  };
}
