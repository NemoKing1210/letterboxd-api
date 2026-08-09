import type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResult,
} from '../../../features/recommendations/types/embedding-provider';
import { ExternalServiceError } from '../../../shared/errors/app-error';
import type { OpenAiHttpClient } from './openai-http-client';

export type OpenAiEmbeddingProviderOptions = {
  client: OpenAiHttpClient;
  model: string;
  dimensions: number;
};

type OpenAiEmbeddingResponse = {
  data?: Array<{ embedding?: number[]; index?: number }>;
  model?: string;
};

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly options: OpenAiEmbeddingProviderOptions) {}

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    if (request.texts.length === 0) {
      return {
        embeddings: [],
        model: request.model ?? this.options.model,
        dimensions: this.options.dimensions,
      };
    }

    const model = request.model ?? this.options.model;
    const response = await this.options.client.postJson<OpenAiEmbeddingResponse>('/embeddings', {
      model,
      input: request.texts,
      dimensions: this.options.dimensions,
    });

    const rows = [...(response.data ?? [])].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );
    if (rows.length !== request.texts.length) {
      throw new ExternalServiceError('OpenAI embeddings response size mismatch', {
        expected: request.texts.length,
        received: rows.length,
      });
    }

    const embeddings = rows.map((row) => {
      if (!row.embedding || row.embedding.length !== this.options.dimensions) {
        throw new ExternalServiceError('OpenAI embedding has unexpected dimensions', {
          expected: this.options.dimensions,
          received: row.embedding?.length ?? 0,
        });
      }
      return row.embedding;
    });

    return {
      embeddings,
      model: response.model ?? model,
      dimensions: this.options.dimensions,
    };
  }
}
