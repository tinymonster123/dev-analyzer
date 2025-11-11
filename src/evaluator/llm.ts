import { EvaluationContext, LlmOptions, Recommendation } from './types';

interface LlmResponse {
  summary: string;
  provider: string;
  model: string;
  raw?: unknown;
}

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export const generateLlmInsights = async (
  context: EvaluationContext,
  recommendations: Recommendation[],
  options?: LlmOptions
): Promise<LlmResponse | null> => {
  const config = resolveConfig(options);
  if (!config.enabled || !config.apiKey) {
    return null;
  }

  try {
    const prompt = buildPrompt(context, recommendations);
    const response = await callOpenAi(config, prompt);
    return {
      summary: response.summary,
      provider: 'openai',
      model: config.model,
      raw: response.raw,
    };
  } catch (error) {
    console.warn(`LLM 调用失败：${(error as Error).message}`);
    return null;
  }
};

const resolveConfig = (options?: LlmOptions): Required<LlmOptions> => {
  const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY ?? '';
  const enabled = options?.enabled ?? Boolean(apiKey);

  return {
    provider: options?.provider ?? 'openai',
    model: options?.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
    endpoint: options?.endpoint ?? process.env.OPENAI_BASE_URL ?? DEFAULT_ENDPOINT,
    apiKey,
    enabled,
  };
};

const buildPrompt = (context: EvaluationContext, recommendations: Recommendation[]): string => {
  const { metrics } = context;

  const issues = [...metrics.errors, ...metrics.warnings]
    .map((issue) => `- [${issue.level.toUpperCase()}] ${issue.message}`)
    .join('\n');

  return [
    context.prompt.combined,
    '',
    '构建事件概览：',
    metrics.buildEvents
      .map(
        (event) =>
          `- ${event.target} | ${event.type} | ${event.durationMs ?? 'N/A'} ms | modules: ${event.modules ?? 'N/A'}`
      )
      .join('\n'),
    '',
    '识别到的问题：',
    issues || '- 无',
    '',
    recommendations.length ? `已有建议数量：${recommendations.length}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

const callOpenAi = async (
  config: Required<LlmOptions>,
  prompt: string
): Promise<{ summary: string; raw: unknown }> => {
  const body = {
    model: config.model,
    messages: [
      {
        role: 'system',
        content:
          '你是一名资深前端性能工程顾问，请根据提供的构建日志指标和问题列表，生成不超过 6 条的优化建议，每条建议包含明确行动项。',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.2,
  };

  const response = await fetch(config.endpoint ?? DEFAULT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`LLM 请求失败，状态码 ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) {
    throw new Error('LLM 响应为空');
  }

  return { summary, raw: data };
};

