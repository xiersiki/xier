export abstract class BaseProvider {
  abstract listModels(): Promise<string[]>;
  abstract chat(messages: DialogueMessageProps[], modelName: string, signal?: AbortSignal): Promise<AsyncIterable<UniversalChunk>>;
}
