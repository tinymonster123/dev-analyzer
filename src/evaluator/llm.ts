import { EvaluationContext, LlmOptions, Recommendation } from './types';
import { DEFAULT_LLM_ENDPOINT, DEFAULT_LLM_MODEL } from './constants';
import { buildLlmPrompt } from './prompt';

interface LlmResponse {
  summary: string;
  provider: string;
  model: string;
  raw?: unknown;
}

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
    const prompt = buildLlmPrompt(context, recommendations);
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
    model: options?.model ?? process.env.OPENAI_MODEL ?? DEFAULT_LLM_MODEL,
    endpoint: options?.endpoint ?? process.env.OPENAI_BASE_URL ?? DEFAULT_LLM_ENDPOINT,
    apiKey,
    enabled,
  };
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

  const response = await fetch(config.endpoint, {
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

