import assert from "node:assert/strict";
import test from "node:test";
import { validateAuthUploadUrl } from "../lib/secure-auth-upload-url.mjs";

test("allows HTTPS upload on a remote hostname", () => {
	assert.equal(validateAuthUploadUrl("https://upload.example.com/auth/sessions"), "https://upload.example.com/auth/sessions");
});

test("allows loopback-only HTTP for a local SSH tunnel", () => {
	for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
		assert.match(validateAuthUploadUrl(`http://${host}:3333/auth/sessions`), /^http:/);
	}
});

test("rejects HTTP over public or private non-loopback hosts", () => {
	for (const hostname of ["203.0.113.7", "10.0.0.8", "upload.example.com", "localhost.evil.test"]) {
		assert.throws(() => validateAuthUploadUrl(`http://${hostname}:3333/auth/sessions`), /Direct public HTTP is blocked/);
	}
});

test("rejects unsupported protocols and embedded credentials", () => {
	assert.throws(() => validateAuthUploadUrl("ftp://upload.example.com/auth/sessions"), /HTTPS or loopback/);
	assert.throws(() => validateAuthUploadUrl("https://user:pass@upload.example.com/auth/sessions"), /must not contain credentials/);
	assert.throws(() => validateAuthUploadUrl("not-a-url"), /Invalid provider session upload URL/);
});
