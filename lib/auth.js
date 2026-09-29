import { timingSafeEqual } from "node:crypto";

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createBasicAuth({ username, password }) {
  const expectedUser = String(username || "");
  const expectedPassword = String(password || "");
  const enabled = expectedUser.length > 0 && expectedPassword.length > 0;

  function isAuthorized(header) {
    if (!enabled) return true;
    if (typeof header !== "string" || !header.startsWith("Basic ")) return false;

    let decoded;
    try {
      decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    } catch {
      return false;
    }

    const separator = decoded.indexOf(":");
    if (separator < 0) return false;

    const user = decoded.slice(0, separator);
    const pass = decoded.slice(separator + 1);
    return safeEqual(user, expectedUser) && safeEqual(pass, expectedPassword);
  }

  return { enabled, isAuthorized };
}
