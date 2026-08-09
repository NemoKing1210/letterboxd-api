export type EmbeddingRequest = {
  texts: string[];
  model?: string;
};

export type EmbeddingResult = {
  embeddings: number[][];
  model: string;
  dimensions: number;
};

export interface EmbeddingProvider {
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
}
