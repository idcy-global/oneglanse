/**
 * Upstream compatibility shim.
 *
 * The commercial fork disables outbound upstream product telemetry.
 * Keeping these exports avoids coupling auth/layout code to telemetry details
 * and leaves a stable seam for a future first-party analytics provider.
 */
export async function trackUserSignup(_userId: string): Promise<void> {
	return;
}

export async function trackUserActive(_userId: string): Promise<void> {
	return;
}
