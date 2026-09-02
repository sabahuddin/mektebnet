const jwtSecret =
  process.env.JWT_SECRET?.trim() ||
  (process.env.NODE_ENV !== "production"
    ? process.env.SESSION_SECRET?.trim()
    : undefined);

if (!jwtSecret) {
  throw new Error(
    "JWT_SECRET environment variable is required. Refusing to start with an insecure default.",
  );
}

export const JWT_SECRET = jwtSecret;