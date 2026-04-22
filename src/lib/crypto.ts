import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
	const key = process.env.ENCRYPTION_KEY;
	if (!key) {
		throw new Error(
			"ENCRYPTION_KEY environment variable is required. Generate with: openssl rand -hex 32",
		);
	}
	if (key.length !== 64) {
		throw new Error(
			"ENCRYPTION_KEY must be 32 bytes (64 hex characters). Generate with: openssl rand -hex 32",
		);
	}
	return Buffer.from(key, "hex");
}

export function encrypt(text: string): string {
	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
	let encrypted = cipher.update(text, "utf8", "hex");
	encrypted += cipher.final("hex");
	const authTag = cipher.getAuthTag();
	return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(text: string): string {
	const [ivHex, authTagHex, encrypted] = text.split(":");
	const iv = Buffer.from(ivHex, "hex");
	const authTag = Buffer.from(authTagHex, "hex");
	const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
	decipher.setAuthTag(authTag);
	let decrypted = decipher.update(encrypted, "hex", "utf8");
	decrypted += decipher.final("utf8");
	return decrypted;
}
