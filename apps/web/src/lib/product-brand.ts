import { env } from "@/env";

export const productName =
	env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || "GEO Platform";

export const productDescription =
	"Track how your brand appears across AI answers, citations, and competitors.";
