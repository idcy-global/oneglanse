const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Reject uploads that could disclose provider sessions or bearer tokens over public HTTP. */
export function validateAuthUploadUrl(rawUrl) {
	let url;
	try {
		url = new URL(rawUrl);
	} catch {
		throw new Error("Invalid provider session upload URL.");
	}

	if (url.username || url.password) {
		throw new Error("Provider session upload URL must not contain credentials.");
	}
	if (url.protocol === "https:") return url.toString();
	if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
		return url.toString();
	}
	throw new Error(
		"Provider sessions require HTTPS or loopback HTTP through an SSH tunnel. Direct public HTTP is blocked.",
	);
}
