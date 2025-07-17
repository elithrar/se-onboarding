// SE Onboarding Lab - Pure Cloudflare Workers + Durable Objects
// No external dependencies - showcasing Cloudflare platform only

import type { ChatMessage, Message } from "../shared";

export class SeOnboardingChat {
  messages = [] as ChatMessage[];
  env: Env;
  mcpSessionId: string | null = null;
  sessions: Map<WebSocket, string> = new Map();

  constructor(private ctx: DurableObjectState, env: Env) {
    this.env = env;
  }

  broadcastMessage(message: Message, sender?: WebSocket) {
    const messageStr = JSON.stringify(message);
    this.sessions.forEach((sessionId, ws) => {
      if (ws !== sender && ws.readyState === WebSocket.READY_STATE_OPEN) {
        ws.send(messageStr);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(webSocket: WebSocket) {
    this.sessions.set(webSocket, crypto.randomUUID());
    
    console.log('[CONN] NEW WEBSOCKET CONNECTION ESTABLISHED');
    console.log('[STATE] Current messages count:', this.messages.length);
    console.log('[AUTH] Current session ID:', this.mcpSessionId);
    
    // Send all existing messages to new connection
    const allMessage = {
      type: "all",
      messages: this.messages,
    } satisfies Message;
    
    webSocket.send(JSON.stringify(allMessage));
    
    // Initialize MCP session if not already done
    if (!this.mcpSessionId) {
      await this.initializeMCPSession();
    }
    
    if (this.mcpSessionId) {
      const readyMessage = {
        type: "session_ready",
        sessionId: this.mcpSessionId,
      };
      webSocket.send(JSON.stringify(readyMessage));
    } else {
      const loadingMessage = {
        type: "session_loading",
      };
      webSocket.send(JSON.stringify(loadingMessage));
    }

    webSocket.addEventListener("message", async (event) => {
      await this.handleMessage(webSocket, event.data);
    });

    webSocket.addEventListener("close", () => {
      console.log('[CONN] WEBSOCKET CONNECTION DISCONNECTED');
      this.sessions.delete(webSocket);
      console.log('[STATE] Remaining connections:', this.sessions.size);
      
      if (this.sessions.size === 0) {
        console.log('[CLEANUP] All connections closed - Durable Object will be cleaned up');
      }
    });

    webSocket.addEventListener("error", (event) => {
      console.log('[ERROR] WebSocket error:', event);
      this.sessions.delete(webSocket);
    });
  }

  async handleMessage(webSocket: WebSocket, message: any) {
    console.log('\n[MSG] RECEIVED MESSAGE');
    console.log('[RAW] Raw message:', message);
    console.log('[AUTH] Current MCP Session ID:', this.mcpSessionId);
    
    // Broadcast the raw message to everyone else
    this.broadcastMessage(message, webSocket);
    console.log('[BROADCAST] Broadcasted message to all connections');

    // Parse and process the message
    const parsed = JSON.parse(message as string) as Message;
    console.log('[HEADERS] Parsed message type:', parsed.type);

    if (parsed.type === "add") {
      console.log('[ADD] Adding message from:', parsed.user);
      console.log('[CONTENT] Message content preview:', parsed.content?.substring(0, 100));
      
      // Save the user message
      this.saveMessage(parsed);
      
      // If it's a user message, get AI response
      if (parsed.role === "user") {
        console.log('[AI] Preparing to call Workers AI...');
        
        try {
          const selectedModel = parsed.model || '@cf/meta/llama-4-scout-17b-16e-instruct';
          console.log('[AI] Using model:', selectedModel);
          
          const response = await this.env.AI.run(selectedModel, {
            messages: [{ role: "user", content: parsed.content }],
          });
          
          const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            user: "SE Onboarding Assistant",
            role: "assistant",
            content: response.response || "I'm here to help with your SE onboarding questions!",
          };
          
          this.saveMessage(aiMessage);
          this.broadcastMessage({
            type: "add",
            ...aiMessage,
          });
          
        } catch (error) {
          console.error('[AI] Error calling Workers AI:', error);
          
          const errorMessage: ChatMessage = {
            id: crypto.randomUUID(),
            user: "SE Onboarding Assistant",
            role: "assistant",
            content: `Thanks for your question: "${parsed.content}". This is the SE Onboarding Lab showcasing Cloudflare Workers, AI, and Durable Objects. (AI model temporarily unavailable)`
          };
          
          this.saveMessage(errorMessage);
          this.broadcastMessage({
            type: "add",
            ...errorMessage,
          });
        }
      }
    }
  }

  async initializeMCPSession() {
    try {
      console.log('=== MCP Session Initialization Start ===');
      console.log('Chat Room:', this.ctx.id);
      console.log('Timestamp:', new Date().toISOString());
      
      // Broadcast loading state immediately
      this.broadcastMessage({
        type: "session_loading",
      });
      
      // Generate session ID
      console.log('Generating session ID...');
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const sessionId = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('').substring(0, 16);
      
      this.mcpSessionId = sessionId;
      console.log('✓ Using generated session ID:', sessionId);
      
      this.broadcastMessage({
        type: "session_ready",
        sessionId: this.mcpSessionId,
      });
      
      console.log('=== MCP Session Initialization End ===');
      
    } catch (error) {
      console.log('=== MCP Session FAILED ===');
      console.log('Error:', (error as Error).message);
      
      this.broadcastMessage({
        type: "session_failed",
        error: (error as Error).message,
      });
    }
  }

  saveMessage(message: ChatMessage) {
    const existingMessage = this.messages.find((m) => m.id === message.id);
    if (existingMessage) {
      this.messages = this.messages.map((m) => {
        if (m.id === message.id) {
          return message;
        }
        return m;
      });
    } else {
      this.messages.push(message);
    }
  }
}

  async onStart() {
    console.log('[CFHELPER] Durable Object starting:', this.ctx.id.toString());
    
    // Don't create persistent storage since we want sessions to be temporary
    this.messages = [];
    // Messages array initialized
    
    // Initialize MCP session
    // Initialize MCP session
    const startTime = Date.now();
    await this.initializeMCPSession();
    const endTime = Date.now();
    console.log(`[CFHELPER] MCP session ready in ${endTime - startTime}ms, messages: ${this.messages.length}`);
  }

  async initializeMCPSession() {
    try {
      console.log('=== MCP Session Initialization Start ===');
      console.log('Chat Room:', this.ctx.id);
      console.log('Timestamp:', new Date().toISOString());
      
      // Broadcast loading state immediately
      this.broadcast(JSON.stringify({
        type: "session_loading",
      }));
      
      // Based on our debug test, we know the SSE endpoint works
      // We need to generate our own sessionId and use it
      console.log('Generating session ID...');
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const sessionId = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
      console.log('Generated sessionId:', sessionId);
      
      // Simply use the generated sessionId directly
      // This matches what works in the terminal
      this.mcpSessionId = sessionId;
      console.log('✓ Using generated session ID:', sessionId);
      
      this.broadcast(JSON.stringify({
        type: "session_ready",
        sessionId: this.mcpSessionId,
      }));
      
      console.log('=== MCP Session Initialization End ===');
      
    } catch (error) {
      console.log('=== MCP Session FAILED ===');
      console.log('Error:', error.message);
      
      // NO FALLBACK - MCP ONLY
      this.broadcast(JSON.stringify({
        type: "session_failed",
        error: error.message,
      }));
    }
  }

  onConnect(connection: Connection) {
    console.log('[CONN] NEW WEBSOCKET CONNECTION ESTABLISHED');
    console.log('[ID] Connection ID:', connection.id);
    console.log('[STATE] Current messages count:', this.messages.length);
    console.log('[AUTH] Current session ID:', this.mcpSessionId);
    console.log('[API] Connection headers:', JSON.stringify(connection.request?.headers || {}));
    console.log('[URL] Connection URL:', connection.request?.url);
    
    const allMessage = {
      type: "all",
      messages: this.messages,
    } satisfies Message;
    
    connection.send(JSON.stringify(allMessage));
    console.log('[SEND] Sent all messages to new connection:', JSON.stringify(allMessage));
    
    // Send session status
    if (this.mcpSessionId) {
      console.log('[SUCCESS] Sending session_ready status to new connection');
      const readyMessage = {
        type: "session_ready",
        sessionId: this.mcpSessionId,
      };
      connection.send(JSON.stringify(readyMessage));
      console.log('[SEND] Session ready message sent:', JSON.stringify(readyMessage));
    } else {
      console.log('[WAIT] Sending session_loading status to new connection');
      const loadingMessage = {
        type: "session_loading",
      };
      connection.send(JSON.stringify(loadingMessage));
      console.log('[SEND] Session loading message sent:', JSON.stringify(loadingMessage));
    }
    
    console.log('[CONN] Connection setup complete for:', connection.id);
  }

  onDisconnect(connection: Connection) {
    console.log('[CONN] WEBSOCKET CONNECTION DISCONNECTED');
    console.log('[ID] Disconnected connection ID:', connection.id);
    console.log('[STATE] Remaining connections:', this.ctx.getWebSockets().length);
    console.log('[MEMORY] Current messages count:', this.messages.length);
    console.log('[AUTH] MCP Session ID still active:', this.mcpSessionId);
    
    // When all connections are closed, the Durable Object will be evicted
    // and the session data will be automatically cleaned up
    if (this.ctx.getWebSockets().length === 0) {
      console.log('[CLEANUP] All connections closed - Durable Object will be cleaned up');
    }
  }

  async fetch(request: Request) {
    // IMPORTANT: Let PartyServer handle WebSocket upgrades
    return super.fetch(request);
  }

  saveMessage(message: ChatMessage) {
    // Only keep messages in memory for this session
    const existingMessage = this.messages.find((m) => m.id === message.id);
    if (existingMessage) {
      this.messages = this.messages.map((m) => {
        if (m.id === message.id) {
          return message;
        }
        return m;
      });
    } else {
      this.messages.push(message);
    }
  }

  async onMessage(connection: Connection, message: WSMessage) {
    console.log('\n[MSG] RECEIVED MESSAGE');
    console.log('[RAW] Raw message:', message);
    console.log('[AUTH] Current MCP Session ID:', this.mcpSessionId);
    console.log('[ID] Chat Room ID:', this.ctx.id);
    
    // let's broadcast the raw message to everyone else
    this.broadcast(message);
    console.log('[BROADCAST] Broadcasted message to all connections');

    // let's update our local messages store
    const parsed = JSON.parse(message as string) as Message;
    console.log('[HEADERS] Parsed message type:', parsed.type);
    console.log('[HEADERS] Parsed message role:', parsed.role);
    
    if (parsed.type === "add" || parsed.type === "update") {
      this.saveMessage(parsed);
      console.log('[MEMORY] Saved message to local store');

      // Process all user messages through AI
      if (parsed.role === "user") {
        console.log('[USER] PROCESSING USER MESSAGE:', parsed.content);
        
        // Simple AI response using Cloudflare Workers AI
        const selectedModel = parsed.model || "@cf/meta/llama-4-scout-17b-16e-instruct";
        console.log(`[AI] Using model: ${selectedModel}`);
        
        try {
          // Call Cloudflare Workers AI
          const aiResponse = await this.env.AI.run(selectedModel, {
            prompt: parsed.content,
            max_tokens: 512,
            temperature: 0.7,
          });
          
          const responseMessage: ChatMessage = {
            id: crypto.randomUUID(),
            user: "SE Onboarding Assistant",
            role: "assistant",
            content: aiResponse.response || `I'm the SE Onboarding Lab assistant powered by ${selectedModel}. I received your message: "${parsed.content}". This demonstrates Cloudflare Workers AI integration!`
          };
          
          this.saveMessage(responseMessage);
          this.broadcastMessage({
            type: "add",
            ...responseMessage,
          });
        } catch (error) {
          console.error('[AI] Error calling Workers AI:', error);
          
          const errorMessage: ChatMessage = {
            id: crypto.randomUUID(),
            user: "SE Onboarding Assistant",
            role: "assistant",
            content: `Thanks for your question: "${parsed.content}". This is the SE Onboarding Lab showcasing Cloudflare Workers, AI, and Durable Objects. (AI model ${selectedModel} temporarily unavailable)`
          };
          
          this.saveMessage(errorMessage);
          this.broadcastMessage({
            type: "add",
            ...errorMessage,
          });
        }
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle API endpoints first
    if (url.pathname === '/cfhelper/api/models' && request.method === 'GET') {
      try {
        // Fetch models from KV store
        const modelsJson = await env.KV_STORE.get('Models');
        if (!modelsJson) {
          throw new Error('Models not found in KV');
        }
        
        const allModels = JSON.parse(modelsJson);
        console.log(`Found ${allModels.length} models in KV`);
        
        // Return only the fields needed by the client
        const models = allModels.map(model => ({
          id: model.id,
          name: model.name,
          description: model.description
        }));
        
        return new Response(JSON.stringify({ models }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        console.error('Error fetching models from KV:', error);
        
        // Fallback to basic models if KV fails
        const models = [
          {
            id: "@cf/meta/llama-4-scout-17b-16e-instruct",
            name: "Llama 4 Scout (17B)",
            description: "Meta's multimodal model - Default"
          }
        ];
        
        return new Response(JSON.stringify({ models }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    // Handle CORS preflight
    if (url.pathname.startsWith('/cfhelper/api/') && request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    
    // Handle PartyKit requests  
    const partyResponse = await routePartykitRequest(request, { 
      ...env, 
      chat: env.SeOnboardingChat  // Map 'chat' party to SeOnboardingChat Durable Object
    });
    if (partyResponse) return partyResponse;
    
    // Handle asset requests
    const assetResponse = await env.ASSETS.fetch(request);
    
    // Clone the response to modify headers
    const response = new Response(assetResponse.body, assetResponse);
    
    // Set CSP to allow our scripts
    response.headers.delete('Content-Security-Policy');
    response.headers.delete('Content-Security-Policy-Report-Only');
    
    response.headers.set('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "connect-src 'self' wss://*.workers.dev; " +
      "img-src 'self' data:; " +
      "font-src 'self';"
    );
    
    return response;
  },
} satisfies ExportedHandler<Env>;
