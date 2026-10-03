import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomBytes, timingSafeEqual, scryptSync } from "node:crypto";

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
  storeFile,
  maxSessions = 100
} = {}) {
  let accounts = [
    account(username, password, "admin"),
    account(technicianUsername, technicianPassword, "technician")
  ].filter(Boolean);

  function digest(password, salt) {
    return scryptSync(password, salt, 32).toString("hex");
  }
  function hashed(candidate) {
    const salt = randomBytes(16).toString("hex");
    return {username:candidate.username, role:candidate.role, disabled:false,
      salt, hash:digest(candidate.password, salt)};
  }
  function persist(next) {
    if (!storeFile) throw new Error("user_store_unavailable");
    mkdirSync(dirname(storeFile), {recursive:true, mode:0o700});
    const temp = storeFile + ".tmp";
    writeFileSync(temp, JSON.stringify({version:1, users:next}, null, 2), {mode:0o600});
    renameSync(temp, storeFile);
    accounts = next;
  }
  if (storeFile) {
    if (existsSync(storeFile)) {
      const data = JSON.parse(readFileSync(storeFile, "utf8"));
      if (data.version !== 1 || !Array.isArray(data.users) || !data.users.length
        || !data.users.some(user => user.role === "super-admin" && !user.disabled)
        || data.users.some(user => !/^[a-zA-Z0-9_.@-]{1,80}$/.test(user.username)
          || !["super-admin","admin","technician","viewer"].includes(user.role)
          || typeof user.disabled !== "boolean" || !/^[a-f0-9]{32}$/.test(user.salt)
          || !/^[a-f0-9]{64}$/.test(user.hash))
        || new Set(data.users.map(user => user.username)).size !== data.users.length) {
        throw new Error("invalid_user_store");
      }
      accounts = data.users;
    } else if (accounts.length) {
      if (!accounts.some(user => user.role === "admin")) throw new Error("bootstrap_admin_required");
      persist(accounts.map(user => hashed({...user, role:user.role === "admin" ? "super-admin" : user.role})));
    }
  }
  const enabled = accounts.length > 0;
  function listUsers() {
    return accounts.map(({username, role, disabled}) => ({username, role, disabled:Boolean(disabled)}));
  }
  function saveUser(input, {create = false, actor} = {}) {
    if (!storeFile || !enabled) throw new Error("user_store_unavailable");
    const name = input?.username;
    if (typeof name !== "string" || !/^[a-zA-Z0-9_.@-]{1,80}$/.test(name)) throw new Error("invalid_username");
    const existing = accounts.find(user => user.username === name);
    if (create && existing) throw new Error("user_exists");
    if (!create && !existing) throw new Error("user_not_found");
    const role = input.role ?? existing?.role;
    if (!["super-admin","admin","technician","viewer"].includes(role)) throw new Error("invalid_role");
    if (input.disabled !== undefined && typeof input.disabled !== "boolean") throw new Error("invalid_status");
    const disabled = input.disabled ?? existing?.disabled ?? false;
    if (actor === name && (disabled || role !== "super-admin")) throw new Error("cannot_demote_self");
    if (input.password !== undefined && (typeof input.password !== "string"
      || input.password.length < 12 || input.password.length > 256)) throw new Error("password_length_12_256");
    if (create && !input.password) throw new Error("password_required");
    const candidate = input.password ? hashed({username:name, password:input.password, role}) : {...existing, role};
    candidate.disabled = disabled;
    const next = existing ? accounts.map(user => user.username === name ? candidate : user) : [...accounts, candidate];
    if (!next.some(user => user.role === "super-admin" && !user.disabled)) throw new Error("last_super_admin");
    persist(next);
    if (existing) for (const [hash, session] of sessions) if (session.username === name) sessions.delete(hash);
    return listUsers().find(user => user.username === name);
  }
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
        !candidate.disabled && safeEqual(candidateUsername, candidate.username)
        && (candidate.hash ? (typeof candidatePassword === "string" && candidatePassword.length <= 256
          && safeEqual(digest(candidatePassword, candidate.salt), candidate.hash))
          : safeEqual(candidatePassword, candidate.password))
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
        actionsEnabled:["super-admin","admin","technician"].includes(candidate.role),
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
      actionsEnabled:["super-admin","admin","technician"].includes(stored.role),
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
    listUsers,
    saveUser,
    login,
    authenticate,
    logout,
    cookie,
    clearCookie,
    verifyCredentials
  };
}
