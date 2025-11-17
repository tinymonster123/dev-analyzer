#!/usr/bin/env node
import path from "path";
import { promises as fs } from "fs";
import { detectManager } from "../detectManager";
import { runDevWithLogs } from "../logCollector";
import { transformLogs } from "../logTransformer";
import { loadEvaluationContext, evaluate } from "../evaluator";
import {
	writeJsonReport,
	writeMarkdownReport,
	writeTextReport,
} from "../reporter";
import { JsonReportOptions } from "../reporter/types";

interface CLIOptions {
	cwd: string;
	skipDev: boolean;
	json: boolean;
	jsonPath?: string;
	markdown: boolean;
	markdownPath?: string;
	text: boolean;
	textPath?: string;
	includeConfig: boolean;
	includeRelated: boolean;
	includeRawLogs: boolean;
	verbose: boolean;
	promptText?: string;
	promptFile?: string;
	llmModel?: string;
	llmEndpoint?: string;
	llmApiKey?: string;
	streamLogs: boolean;
}

const DEFAULT_OPTIONS: CLIOptions = {
	cwd: process.env.DEV_ANALYZER_CWD || process.cwd(),
	skipDev: process.env.DEV_ANALYZER_SKIP_DEV === "true",
	json: process.env.DEV_ANALYZER_JSON !== "false",
	jsonPath: process.env.DEV_ANALYZER_JSON_PATH,
	markdown: process.env.DEV_ANALYZER_MARKDOWN !== "false",
	markdownPath: process.env.DEV_ANALYZER_MARKDOWN_PATH,
	text: process.env.DEV_ANALYZER_TEXT === "true",
	textPath: process.env.DEV_ANALYZER_TEXT_PATH,
	includeConfig: process.env.DEV_ANALYZER_INCLUDE_CONFIG === "true",
	includeRelated: process.env.DEV_ANALYZER_INCLUDE_RELATED === "true",
	includeRawLogs: process.env.DEV_ANALYZER_INCLUDE_RAW_LOGS === "true",
	verbose: process.env.DEV_ANALYZER_VERBOSE === "true",
	promptText: process.env.DEV_ANALYZER_PROMPT,
	promptFile: process.env.DEV_ANALYZER_PROMPT_FILE,
	llmModel: process.env.DEV_ANALYZER_LLM_MODEL || process.env.OPENAI_MODEL,
	llmEndpoint:
		process.env.DEV_ANALYZER_LLM_ENDPOINT || process.env.OPENAI_BASE_URL,
	llmApiKey: process.env.DEV_ANALYZER_LLM_API_KEY || process.env.OPENAI_API_KEY,
	streamLogs: process.env.DEV_ANALYZER_STREAM_LOGS !== "false",
};

const HELP_TEXT = `Dev Analyzer CLI

Usage:
  dev-analyzer [analyze] [options]

Options:
  --cwd <path>               指定待分析项目的根目录 (env: DEV_ANALYZER_CWD)
  --skip-dev                 跳过 dev 命令 (env: DEV_ANALYZER_SKIP_DEV)
  --json [path]              生成 JSON 报告（默认开启，env: DEV_ANALYZER_JSON_PATH）
  --no-json                  不生成 JSON 报告
  --markdown [path]          生成 Markdown 报告（默认开启，env: DEV_ANALYZER_MARKDOWN_PATH）
  --no-markdown              不生成 Markdown 报告
  --text [path]              生成纯文本报告 (env: DEV_ANALYZER_TEXT_PATH)
  --include-config           在报告中包含配置文件内容 (env: DEV_ANALYZER_INCLUDE_CONFIG)
  --include-related          在报告中包含相关文件内容 (env: DEV_ANALYZER_INCLUDE_RELATED)
  --include-raw-logs         JSON 报告附带原始日志 (env: DEV_ANALYZER_INCLUDE_RAW_LOGS)
  --prompt <text>            为评估附加自定义提示语 (env: DEV_ANALYZER_PROMPT)
  --prompt-file <path>       从文件读取自定义提示语 (env: DEV_ANALYZER_PROMPT_FILE)
  --stream-logs              实时打印 dev 命令日志（默认开启，env: DEV_ANALYZER_STREAM_LOGS）
  --no-stream-logs           不在终端输出 dev 日志
  --verbose                  文本报告包含详细列表 (env: DEV_ANALYZER_VERBOSE)
  --help, -h                 查看帮助
  --version, -v              查看版本号

LLM 配置（优先级：命令行 > DEV_ANALYZER_* > OPENAI_*）:
  --llm-model <name>         指定 LLM 模型 (env: DEV_ANALYZER_LLM_MODEL, OPENAI_MODEL)
  --llm-endpoint <url>       指定 LLM 接口地址 (env: DEV_ANALYZER_LLM_ENDPOINT, OPENAI_BASE_URL)
  --llm-api-key <key>        LLM API Key (env: DEV_ANALYZER_LLM_API_KEY, OPENAI_API_KEY)

Examples:
  # 基础用法（自动读取 OPENAI_API_KEY）
  dev-analyzer

  # 指定项目路径
  dev-analyzer --cwd /path/to/project

  # 使用环境变量
  export OPENAI_API_KEY="sk-..."
  export DEV_ANALYZER_INCLUDE_CONFIG=true
  dev-analyzer
`;

async function main() {
	const args = process.argv.slice(2);

	// 显示帮助
	if (!args.length || args.includes("--help") || args.includes("-h")) {
		console.log(HELP_TEXT);
		return;
	}

	// 显示版本
	if (args.includes("--version") || args.includes("-v")) {
		await printVersion();
		return;
	}

	// 支持省略 "analyze" 命令，直接使用选项
	const firstArg = args[0];
	const startsWithFlag =
		firstArg?.startsWith("--") || firstArg?.startsWith("-");

	let command = "analyze";
	let optionArgs = args;

	if (!startsWithFlag) {
		command = firstArg;
		optionArgs = args.slice(1);
	}

	if (command !== "analyze") {
		console.error(`未知命令：${command}`);
		console.log(HELP_TEXT);
		process.exitCode = 1;
		return;
	}

	const options = await parseOptions(optionArgs);
	await runAnalyze(options);
}

async function runAnalyze(options: CLIOptions) {
	const cwd = path.resolve(options.cwd);
	const outputs: string[] = [];

	console.log(`工作目录：${cwd}`);
	const manager = await detectManager({ cwd });
	console.log(
		`检测到包管理器：${manager.packageManager}, 框架：${manager.framework.name || "Unknown"}`,
	);

	let transform = transformLogs({
		framework: manager.framework.name,
		logs: [],
	});

	if (!options.skipDev) {
		console.log("正在执行 dev 命令并收集日志...");
		try {
			const devResult = await runDevWithLogs({
				cwd,
				managerResult: manager,
				onLog: options.streamLogs
					? (entry) => {
							console.log(`[dev ${entry.type}] ${entry.message}`);
						}
					: undefined,
			});
			if (devResult.exitCode !== 0) {
				console.warn(
					`dev 命令退出码 ${devResult.exitCode} (signal: ${devResult.signal ?? "none"})`,
				);
			}
			transform = transformLogs({
				framework: manager.framework.name,
				logs: devResult.logs,
			});
			console.log(`日志采集完成，共 ${devResult.logs.length} 行。`);
			console.log(
				"若采集过程中需提前结束，可在终端按 Ctrl+C 终止 dev 子进程。",
			);
		} catch (error) {
			console.error("执行 dev 命令失败：", (error as Error).message);
			if (!transform.rawLogs.length) {
				console.warn("将使用空日志继续评估。");
			}
		}
	} else {
		console.log("已跳过 dev 日志采集。");
	}

	const customPrompt = await loadPrompt(options);

	const context = await loadEvaluationContext({
		cwd,
		transform,
		customPrompt,
	});

	const apiKey = options.llmApiKey ?? process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error(
			"未检测到 OPENAI_API_KEY，请通过环境变量或 --llm-api-key 提供 LLM 密钥。",
		);
	}

	const evaluation = await evaluate(context, {
		llm: {
			enabled: true,
			model: options.llmModel,
			endpoint: options.llmEndpoint,
			apiKey,
		},
	});
	console.log("已将结构化日志交给 LLM 进行分析，等待建议生成...");

	const reportOptions: JsonReportOptions = {
		cwd,
		outputPath: options.jsonPath,
		includeConfigFiles: options.includeConfig,
		includeRelatedFiles: options.includeRelated,
		includeRawLogs: options.includeRawLogs,
	};

	if (!options.json && !options.markdown && !options.text) {
		options.markdown = true;
	}

	if (options.json) {
		const jsonPath = await writeJsonReport(evaluation, reportOptions);
		outputs.push(jsonPath);
	}

	if (options.markdown) {
		const markdownPath = await writeMarkdownReport(evaluation, {
			cwd,
			outputPath: options.markdownPath,
			includeConfig: options.includeConfig,
			includeRelated: options.includeRelated,
		});
		outputs.push(markdownPath);
	}

	if (options.text) {
		const textPath = await writeTextReport(evaluation, {
			cwd,
			outputPath: options.textPath,
			verbose: options.verbose,
		});
		outputs.push(textPath);
	}

	console.log("分析完成，生成的报告：");
	outputs.forEach((output) => console.log(`  - ${output}`));
}

async function parseOptions(args: string[]): Promise<CLIOptions> {
	const options: CLIOptions = { ...DEFAULT_OPTIONS };

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		switch (arg) {
			case "--cwd":
				options.cwd = expectValue(args, ++i, "--cwd 需要指定路径");
				break;
			case "--skip-dev":
				options.skipDev = true;
				break;
			case "--json":
				options.json = true;
				if (hasValue(args, i + 1)) {
					options.jsonPath = path.normalize(args[++i]);
				}
				break;
			case "--no-json":
				options.json = false;
				break;
			case "--markdown":
				options.markdown = true;
				if (hasValue(args, i + 1)) {
					options.markdownPath = path.normalize(args[++i]);
				}
				break;
			case "--no-markdown":
				options.markdown = false;
				break;
			case "--text":
				options.text = true;
				if (hasValue(args, i + 1)) {
					options.textPath = path.normalize(args[++i]);
				}
				break;
			case "--include-config":
				options.includeConfig = true;
				break;
			case "--include-related":
				options.includeRelated = true;
				break;
			case "--include-raw-logs":
				options.includeRawLogs = true;
				break;
			case "--prompt":
				options.promptText = expectValue(args, ++i, "--prompt 需要指定文本");
				break;
			case "--prompt-file":
				options.promptFile = expectValue(
					args,
					++i,
					"--prompt-file 需要指定文件路径",
				);
				break;
			case "--verbose":
				options.verbose = true;
				break;
			case "--stream-logs":
				options.streamLogs = true;
				break;
			case "--no-stream-logs":
				options.streamLogs = false;
				break;
			case "--llm-model":
				options.llmModel = expectValue(
					args,
					++i,
					"--llm-model 需要指定模型名称",
				);
				break;
			case "--llm-endpoint":
				options.llmEndpoint = expectValue(
					args,
					++i,
					"--llm-endpoint 需要指定地址",
				);
				break;
			case "--llm-api-key":
				options.llmApiKey = expectValue(
					args,
					++i,
					"--llm-api-key 需要指定密钥",
				);
				break;
			default:
				console.warn(`忽略未知参数：${arg}`);
				break;
		}
	}

	return options;
}

async function loadPrompt(options: CLIOptions): Promise<string | undefined> {
	if (options.promptText) {
		return options.promptText;
	}

	if (options.promptFile) {
		const promptPath = path.resolve(options.cwd, options.promptFile);
		try {
			const content = await fs.readFile(promptPath, "utf8");
			return content;
		} catch (error) {
			console.warn(
				`读取自定义提示词失败 (${promptPath})：${(error as Error).message}`,
			);
		}
	}

	return undefined;
}

function expectValue(args: string[], index: number, message: string): string {
	if (index >= args.length || args[index].startsWith("--")) {
		throw new Error(message);
	}
	return args[index];
}

function hasValue(args: string[], index: number): boolean {
	return index < args.length && !args[index].startsWith("--");
}

async function printVersion() {
	try {
		const pkgPath = path.resolve(__dirname, "../../package.json");
		const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
		console.log(pkg.version ?? "0.0.0");
	} catch {
		console.log("0.0.0");
	}
}

main().catch((error) => {
	console.error("执行失败：", error);
	process.exitCode = 1;
});
