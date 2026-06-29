import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Hash de senha com scrypt (nativo do Node — sem dependências externas).
// Formato armazenado: "<salt_hex>:<hash_hex>".

const scryptAsync = promisify(scrypt);

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(plain, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  const [salt, key] = (stored ?? "").split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derived = (await scryptAsync(plain, salt, 64)) as Buffer;
  return (
    keyBuffer.length === derived.length && timingSafeEqual(keyBuffer, derived)
  );
}
