import { base32Encode, verifyTotp } from "./totp.js";
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomBytes, timingSafeEqual, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";

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
  keyFile = storeFile ? storeFile + ".key" : undefined,
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
          || !/^[a-f0-9]{64}$/.test(user.hash)
          || (user.twoFactor && (user.twoFactor.enabled !== true
            || typeof user.twoFactor.secret !== "string"
            || !Array.isArray(user.twoFactor.recoveryHashes)
            || user.twoFactor.recoveryHashes.some(hash => !/^[a-f0-9]{64}$/.test(hash))
            || !Number.isSafeInteger(user.twoFactor.lastCounter))))
        || new Set(data.users.map(user => user.username)).size !== data.users.length) {
        throw new Error("invalid_user_store");
      }
      accounts = data.users;
    } else if (accounts.length) {
      if (!accounts.some(user => user.role === "admin")) throw new Error("bootstrap_admin_required");
      persist(accounts.map(user => hashed({...user, role:user.role === "admin" ? "super-admin" : user.role})));
    }
  }
  let encryptionKey;
  function loadKey({create=false}={}) {
    if(encryptionKey)return encryptionKey;
    if(!keyFile)throw new Error("user_store_unavailable");
    if(!existsSync(keyFile)) {
      if(!create)throw new Error("two_factor_key_missing");
      mkdirSync(dirname(keyFile),{recursive:true,mode:0o700});
      writeFileSync(keyFile,randomBytes(32),{mode:0o600,flag:"wx"});
    }
    encryptionKey=readFileSync(keyFile);
    if(encryptionKey.length!==32)throw new Error("two_factor_key_invalid");
    return encryptionKey;
  }
  function encryptSecret(secret,name) {
    const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",loadKey({create:true}),iv);
    cipher.setAAD(Buffer.from(name));
    const ciphertext=Buffer.concat([cipher.update(secret,"utf8"),cipher.final()]);
    return [iv,cipher.getAuthTag(),ciphertext].map(part=>part.toString("base64")).join(".");
  }
  function decryptSecret(secret,name) {
    const [iv,tag,ciphertext]=secret.split(".").map(part=>Buffer.from(part,"base64"));
    const cipher=createDecipheriv("aes-256-gcm",loadKey(),iv);
    cipher.setAAD(Buffer.from(name));cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(ciphertext),cipher.final()]).toString("utf8");
  }
  for(const user of accounts)if(user.twoFactor?.enabled)decryptSecret(user.twoFactor.secret,user.username);
  const pendingSetups=new Map();
  const enabled = accounts.length > 0;
  function listUsers() {
    return accounts.map(({username, role, disabled, twoFactor}) => ({username, role, disabled:Boolean(disabled), twoFactorEnabled:Boolean(twoFactor?.enabled)}));
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
    const candidate = input.password ? {...existing, ...hashed({username:name, password:input.password, role})} : {...existing, role};
    candidate.disabled = disabled;
    const next = existing ? accounts.map(user => user.username === name ? candidate : user) : [...accounts, candidate];
    if (!next.some(user => user.role === "super-admin" && !user.disabled)) throw new Error("last_super_admin");
    persist(next);
    if (existing) revoke(name);
    return listUsers().find(user => user.username === name);
  }
  const ttlMs = Math.max(5 * 60 * 1000, Number(sessionTtlMs) || 8 * 60 * 60 * 1000);
  const sessions = new Map();
  function revoke(name, exceptCookie) {
    const keep=exceptCookie ? tokenHash(parseCookie(exceptCookie,COOKIE_NAME)) : null;
    for(const [hash,session] of sessions)if(session.username===name&&hash!==keep)sessions.delete(hash);
    for(const [hash,setup] of pendingSetups)if(setup.username===name)pendingSetups.delete(hash);
  }
  function deleteUser(name,actor) {
    if(!storeFile||!enabled)throw new Error("user_store_unavailable");
    if(name===actor)throw new Error("cannot_delete_self");
    if(!accounts.some(user=>user.username===name))throw new Error("user_not_found");
    const next=accounts.filter(user=>user.username!==name);
    if(!next.some(user=>user.role==="super-admin"&&!user.disabled))throw new Error("last_super_admin");
    persist(next);revoke(name);
    return {username:name};
  }
  function updateFactor(name,twoFactor) {
    persist(accounts.map(user=>user.username===name?{...user,twoFactor}:user));
  }
  function recoveryHash(name,code) {
    return createHash("sha256").update(name+":"+String(code).replace(/-/g,"").trim().toLowerCase()).digest("hex");
  }
  function recoveryCodes(name) {
    const codes=Array.from({length:10},()=>randomBytes(10).toString("hex").match(/.{1,5}/g).join("-"));
    return {codes,hashes:codes.map(code=>recoveryHash(name,code))};
  }
  function consumeFactor(user,token) {
    if(!user.twoFactor?.enabled)return false;
    const factor=user.twoFactor;
    const counter=verifyTotp(decryptSecret(factor.secret,user.username),token,{lastCounter:factor.lastCounter});
    if(counter!==null) {
      updateFactor(user.username,{...factor,lastCounter:counter});return true;
    }
    if(typeof token!=="string"||!/^[a-fA-F0-9-]{20,23}$/.test(token.trim()))return false;
    const hash=recoveryHash(user.username,token);
    if(!factor.recoveryHashes.some(item=>safeEqual(item,hash)))return false;
    updateFactor(user.username,{...factor,recoveryHashes:factor.recoveryHashes.filter(item=>item!==hash)});
    return true;
  }
  function securityStatus(name) {
    const user=accounts.find(user=>user.username===name);
    if(!user)throw new Error("user_not_found");
    return {twoFactorEnabled:Boolean(user.twoFactor?.enabled),recoveryCodesRemaining:user.twoFactor?.recoveryHashes?.length||0};
  }
  function securityAction(cookieHeader,action,{password,token}={}) {
    const session=authenticate(cookieHeader);
    if(!session.authenticated)throw new Error("login_required");
    const user=verifyCredentials(session.username,password);
    if(!user)throw new Error("invalid_credentials");
    if(!storeFile)throw new Error("user_store_unavailable");
    const hash=tokenHash(parseCookie(cookieHeader,COOKIE_NAME));
    if(action==="setup") {
      if(user.twoFactor?.enabled)throw new Error("two_factor_already_enabled");
      const secret=base32Encode(randomBytes(20));
      pendingSetups.set(hash,{username:user.username,secret,expiresAt:Date.now()+600000});
      const uri="otpauth://totp/"+encodeURIComponent("DISTILLERIE Supervisor:"+user.username)+"?secret="+secret+"&issuer="+encodeURIComponent("DISTILLERIE Supervisor")+"&algorithm=SHA1&digits=6&period=30";
      return {secret,uri};
    }
    if(action==="confirm") {
      const setup=pendingSetups.get(hash);
      if(!setup||setup.expiresAt<=Date.now()||setup.username!==user.username)throw new Error("two_factor_setup_expired");
      if(user.twoFactor?.enabled)throw new Error("two_factor_already_enabled");
      const counter=verifyTotp(setup.secret,token);
      if(counter===null)throw new Error("invalid_two_factor");
      const recovery=recoveryCodes(user.username);
      updateFactor(user.username,{enabled:true,secret:encryptSecret(setup.secret,user.username),lastCounter:counter,recoveryHashes:recovery.hashes});
      revoke(user.username,cookieHeader);
      return {twoFactorEnabled:true,recoveryCodes:recovery.codes};
    }
    if(!["disable","recovery"].includes(action))throw new Error("invalid_security_action");
    if(!consumeFactor(user,token))throw new Error("invalid_two_factor");
    if(action==="disable") {
      updateFactor(user.username,undefined);revoke(user.username);
      return {twoFactorEnabled:false};
    }
    const recovery=recoveryCodes(user.username),fresh=accounts.find(item=>item.username===user.username);
    updateFactor(user.username,{...fresh.twoFactor,recoveryHashes:recovery.hashes});
    revoke(user.username,cookieHeader);
    return {twoFactorEnabled:true,recoveryCodes:recovery.codes};
  }

  function cleanup(now = Date.now()) {
    for(const [hash,setup] of pendingSetups)if(setup.expiresAt<=now)pendingSetups.delete(hash);
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

  function login(candidateUsername, candidatePassword, factorToken) {
    cleanup();
    const candidate = verifyCredentials(candidateUsername, candidatePassword);
    if (!candidate) return null;
    if(candidate.twoFactor?.enabled) {
      if(!factorToken)return {requiresTwoFactor:true};
      if(!consumeFactor(candidate,factorToken))return null;
    }

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
    pendingSetups.delete(tokenHash(token));
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
    deleteUser,
    securityStatus,
    securityAction,
    login,
    authenticate,
    logout,
    cookie,
    clearCookie,
    verifyCredentials
  };
}
