export const AUTH_COOKIE_NAME = "transit_auth";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedAuthToken(): Promise<string> {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    throw new Error("APP_PASSWORD environment variable is not set");
  }
  return sha256Hex(password);
}

export async function isCorrectPassword(password: string): Promise<boolean> {
  return password === process.env.APP_PASSWORD;
}

export async function isValidAuthToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const expected = await expectedAuthToken();
  return token === expected;
}
