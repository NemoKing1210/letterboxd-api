import type {
  LlmJsonRequest,
  LlmProvider,
} from '../../../features/recommendations/types/llm-provider';
import { ExternalServiceError } from '../../../shared/errors/app-error';
import type { OpenAiHttpClient } from './openai-http-client';

export type OpenAiLlmProviderOptions = {
  client: OpenAiHttpClient;
  model: string;
};

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export class OpenAiLlmProvider implements LlmProvider {
  constructor(private readonly options: OpenAiLlmProviderOptions) {}

  async completeJson<T>(request: LlmJsonRequest): Promise<T> {
    const model = request.model ?? this.options.model;
    const response = await this.options.client.postJson<OpenAiChatResponse>('/chat/completions', {
      model,
      temperature: request.temperature ?? 0.2,
      response_format: { type: 'json_object' },
      messages: request.messages,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new ExternalServiceError('OpenAI chat returned empty content');
    }

    try {
      return JSON.parse(content) as T;
    } catch (cause) {
      throw new ExternalServiceError('OpenAI chat returned invalid JSON', undefined, cause);
    }
  }
}
