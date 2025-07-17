interface Env {
  CFHelperChat: DurableObjectNamespace<import("./index").CFHelperChat>;
  ASSETS: Fetcher;
  cfhelper_kv: KVNamespace;
  AI: {
    run(model: string, input: {
      prompt: string;
      max_tokens?: number;
      temperature?: number;
    }, options?: {
      gateway?: {
        id: string;
      };
    }): Promise<{
      response: string;
    }>;
    models(): Promise<Array<{
      name: string;
      description?: string;
      properties?: any;
    }>>;
  };
  // CF-Access validation secrets
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
  // AI Gateway configuration
  AI_GATEWAY_TOKEN?: string;
  
  // Gateway URLs - if set, that provider uses the gateway
  CLOUDFLARE_WORKERS_AI_GATEWAY?: string; // Gateway URL for Workers AI
  CLOUDFLARE_OPENAI_GATEWAY?: string; // Gateway URL for OpenAI
  CLOUDFLARE_ANTHROPIC_GATEWAY?: string; // Gateway URL for Anthropic
  // API keys for external providers
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  // Legacy secret for backward compatibility
  CFHELPER_SECRET?: string;
}