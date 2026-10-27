import {
	edgeNetworkName,
	ensureDockerNetwork,
	ensureEnvFiles,
	runCommandCapture,
} from "./lib/runtime.mjs";

const COMMANDS_REQUIRING_EDGE_NETWORK = new Set(["create", "start", "up"]);
const COMPOSE_FILE = "docker-compose.yml";
const DEFAULT_IMAGES = {
	ONEGLANSE_AGENT_IMAGE: "idcy-geo-agent:local",
	ONEGLANSE_POSTGRES_IMAGE: "idcy-geo-postgres:local",
	ONEGLANSE_WEB_IMAGE: "idcy-geo-web:local",
};
const PULLABLE_SERVICES = [
	{ service: "redis" },
	{ service: "clickhouse" },
	{
		service: "agent-worker",
		envKey: "ONEGLANSE_AGENT_IMAGE",
		defaultImage: DEFAULT_IMAGES.ONEGLANSE_AGENT_IMAGE,
	},
	{
		service: "db",
		envKey: "ONEGLANSE_POSTGRES_IMAGE",
		defaultImage: DEFAULT_IMAGES.ONEGLANSE_POSTGRES_IMAGE,
	},
	{
		service: "web",
		envKey: "ONEGLANSE_WEB_IMAGE",
		defaultImage: DEFAULT_IMAGES.ONEGLANSE_WEB_IMAGE,
	},
	{
		service: "migrate",
		envKey: "ONEGLANSE_WEB_IMAGE",
		defaultImage: DEFAULT_IMAGES.ONEGLANSE_WEB_IMAGE,
	},
];

function parseArgs(argv) {
	const args = [...argv];
	return {
		composeArgs: args.length > 0 ? args : ["up", "-d", "--build"],
	};
}

function shouldPullConfiguredImage(envKey, defaultImage) {
	if (!envKey) {
		return true;
	}

	const configured = process.env[envKey]?.trim();
	if (!configured) {
		return defaultImage.includes("/");
	}

	return configured.includes("/");
}

async function runCompose(composeArgs) {
	await runComposeCommand([...composeArgs]);
}

async function runComposeCommand(composeArgs) {
	const { stdout, stderr } = await runCommandCapture("docker", [
		"compose",
		"-f",
		COMPOSE_FILE,
		...composeArgs,
	]);
	if (stdout) {
		process.stdout.write(stdout);
	}
	if (stderr) {
		process.stderr.write(stderr);
	}
}

async function runSmartPull() {
	const pullableServices = PULLABLE_SERVICES.filter((entry) =>
		shouldPullConfiguredImage(entry.envKey, entry.defaultImage),
	).map((entry) => entry.service);

	if (pullableServices.length === 0) {
		console.log(
			"Skipping docker pull: no remote images configured for the app stack.",
		);
		return;
	}

	await runComposeCommand(["pull", ...pullableServices]);
}

async function runBootstrap() {
	await ensureDockerNetwork(edgeNetworkName);
	await runSmartPull();
	// Always build application images from this checkout for the commercial MVP.
	// An upstream GHCR release must never be silently deployed instead of this fork.
	await runCompose(["up", "-d", "--build", "--force-recreate"]);
	console.log("Self-host stack started from this checkout's Docker build.");
}

async function main() {
	await ensureEnvFiles();
	const { composeArgs } = parseArgs(process.argv.slice(2));
	if (composeArgs[0] === "bootstrap") {
		await runBootstrap();
		return;
	}
	if (composeArgs[0] === "pull") {
		await runSmartPull();
		return;
	}
	if (COMMANDS_REQUIRING_EDGE_NETWORK.has(composeArgs[0] ?? "")) {
		await ensureDockerNetwork(edgeNetworkName);
	}
	await runCompose(composeArgs);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
