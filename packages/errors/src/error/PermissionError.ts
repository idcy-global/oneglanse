import { BaseError } from "./BaseError.js";

export class PermissionError extends BaseError {
	constructor(message = "Forbidden", cause?: unknown) {
		super(message, { code: "PERMISSION_DENIED", status: 403, cause });
	}
}
