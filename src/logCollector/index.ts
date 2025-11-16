import { spawn } from "child_process";
import path from "path";
import readline from "readline";
import { Readable } from "stream";
import { detectManager } from "../detectManager";
import {
	LogCollectorOptions,
	DevCommandResult,
	LogEntry,
	ResolveCommandOptions,
	CommandConfig,
} from "./types";

/**
 * 执行包管理器 dev 命令并捕获日志输出，可选实时回调。
 */
export const runDevWithLogs = async (
	options: LogCollectorOptions = {},
): Promise<DevCommandResult> => {
	const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
	const managerResult = options.managerResult ?? (await detectManager({ cwd }));
	const commandConfig = resolveDevCommand({
		manager: managerResult.packageManager,
		fallbackCommand: options.command,
		fallbackArgs: options.args,
	});

	const logs: LogEntry[] = [];
	const child = spawn(commandConfig.command, commandConfig.args, {
		cwd,
		stdio: ["ignore", "pipe", "pipe"],
		env: {
			...process.env,
			FORCE_COLOR: "1",
		},
	});

	const handleLog = (entry: LogEntry) => {
		logs.push(entry);
		options.onLog?.(entry);
	};

	const onSigint = () => {
		try {
			child.kill("SIGINT");
		} catch {
			// ignore
		}
		const interruptionEntry: LogEntry = {
			type: "stdout",
			message: "[dev-analyzer] 捕获到 Ctrl+C，正在终止 dev 进程...",
			timestamp: Date.now(),
		};
		handleLog(interruptionEntry);
	};

	process.once("SIGINT", onSigint);

	const stdoutPromise = collectStream(child.stdout, "stdout", handleLog);
	const stderrPromise = collectStream(child.stderr, "stderr", handleLog);

	try {
		const exit = await new Promise<{
			code: number | null;
			signal: NodeJS.Signals | null;
		}>((resolve, reject) => {
			child.on("error", (error) => reject(error));
			child.on("exit", (code, signal) => resolve({ code, signal }));
		});

		await Promise.all([stdoutPromise, stderrPromise]);

		return {
			exitCode: exit.code,
			signal: exit.signal,
			logs,
		};
	} finally {
		process.removeListener("SIGINT", onSigint);
	}
};

/**
 * 根据包管理器确定运行 dev 的命令，必要时接受自定义覆盖。
 */
const resolveDevCommand = (options: ResolveCommandOptions): CommandConfig => {
	if (options.fallbackCommand) {
		return {
			command: options.fallbackCommand,
			args: options.fallbackArgs ?? [],
		};
	}

	switch (options.manager) {
		case "pnpm":
			return { command: "pnpm", args: ["run", "dev"] };
		case "yarn":
			return { command: "yarn", args: ["run", "dev"] };
		case "bun":
			return { command: "bun", args: ["run", "dev"] };
		case "npm":
			return { command: "npm", args: ["run", "dev"] };
		case "unknown":
		default:
			return { command: "npm", args: ["run", "dev"] };
	}
};

/**
 * 将流按行拆分为日志条目，并传递给回调。
 */
const collectStream = async (
	stream: Readable | null,
	type: LogEntry["type"],
	onLog: (entry: LogEntry) => void,
): Promise<void> => {
	if (!stream) return;

	const reader = readline.createInterface({ input: stream });
	reader.on("line", (line) => {
		onLog({
			type,
			message: line,
			timestamp: Date.now(),
		});
	});

	await new Promise<void>((resolve) => {
		reader.on("close", () => resolve());
		stream.on("error", () => resolve());
	});
};
