import { timingSafeEqual } from "node:crypto";

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function parseBasic(header) {
  if (typeof header !== "string" || !header.startsWith("Basic ")) return null;

  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return null;
  }

  const separator = decoded.indexOf(":");
  if (separator < 0) return null;
  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1)
  };
}

function account(username, password, role) {
  const user = String(username || "");
  const pass = String(password || "");
  if (!user || !pass) return null;
  return { username:user, password:pass, role };
}

export function createBasicAuth({
  username,
  password,
  technicianUsername,
  technicianPassword
} = {}) {
  // The historical SUPERVISOR_USERNAME / SUPERVISOR_PASSWORD pair is the
  // administrator account. This preserves existing deployments.
  const accounts = [
    account(username, password, "admin"),
    account(technicianUsername, technicianPassword, "technician")
  ].filter(Boolean);

  const enabled = accounts.length > 0;

  function authenticate(header) {
    if (!enabled) {
      return {
        authenticated: false,
        username: null,
        role: "viewer",
        actionsEnabled: false
      };
    }

    const credentials = parseBasic(header);
    if (!credentials) {
      return {
        authenticated: false,
        username: null,
        role: "viewer",
        actionsEnabled: false
      };
    }

    for (const candidate of accounts) {
      if (
        safeEqual(credentials.username, candidate.username)
        && safeEqual(credentials.password, candidate.password)
      ) {
        return {
          authenticated: true,
          username: candidate.username,
          role: candidate.role,
          actionsEnabled: ["admin", "technician"].includes(candidate.role)
        };
      }
    }

    return {
      authenticated: false,
      username: null,
      role: "viewer",
      actionsEnabled: false
    };
  }

  function isAuthorized(header) {
    return !enabled || authenticate(header).authenticated;
  }

  return {
    enabled,
    authenticate,
    isAuthorized
  };
}
