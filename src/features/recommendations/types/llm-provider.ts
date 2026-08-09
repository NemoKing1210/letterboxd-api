export type LlmChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmJsonRequest = {
  messages: LlmChatMessage[];
  model?: string;
  temperature?: number;
};

export interface LlmProvider {
  completeJson<T>(request: LlmJsonRequest): Promise<T>;
}
