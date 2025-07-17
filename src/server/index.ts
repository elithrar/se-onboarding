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
      if (ws.readyState === WebSocket.READY_STATE_OPEN) {
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
    
    // Parse the message first
    const parsed = JSON.parse(message as string) as Message;
    console.log('[HEADERS] Parsed message type:', parsed.type);

    if (parsed.type === "add") {
      console.log('[ADD] Adding message from:', parsed.user);
      console.log('[CONTENT] Message content preview:', parsed.content?.substring(0, 100));
      
      // Save the user message
      this.saveMessage(parsed);
      
      // Broadcast the message to all clients (including sender)
      this.broadcastMessage(parsed);
      
      // If it's a user message, get AI response
      if (parsed.role === "user") {
        console.log('[AI] Preparing AI response...');
        console.log('[MCP] MCP enabled:', parsed.useMCP);
        
        try {
          const selectedModel = parsed.model || '@cf/meta/llama-4-scout-17b-16e-instruct';
          console.log('[AI] Using model:', selectedModel);
          
          let aiResponseContent: string;
          
          if (parsed.useMCP) {
            // Use MCP for Cloudflare documentation search
            console.log('[MCP] Using Cloudflare Documentation Search');
            aiResponseContent = await this.handleMCPRequest(parsed.content, selectedModel);
          } else {
            // Use standard AI without MCP
            console.log('[AI] Using standard AI without MCP');
            
            // Build conversation history for AI context
            const conversationHistory = this.messages
              .filter(msg => msg.role === "user" || msg.role === "assistant")
              .map(msg => ({ role: msg.role, content: msg.content }));
            
            console.log('[AI] Conversation history length:', conversationHistory.length);
            
            const response = await this.env.AI.run(selectedModel, {
              messages: conversationHistory,
            });
            
            aiResponseContent = response.response || "I'm here to help with your questions!";
          }
          
          const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            user: parsed.useMCP ? "CF Helper" : "SE Onboarding Assistant",
            role: "assistant",
            content: aiResponseContent,
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

  async handleMCPRequest(userQuery: string, selectedModel: string): Promise<string> {
    try {
      console.log('[MCP] Starting MCP request for query:', userQuery);
      
      // Ensure we have an MCP session
      if (!this.mcpSessionId) {
        await this.initializeMCPSession();
      }
      
      if (!this.mcpSessionId) {
        throw new Error('Could not establish MCP session');
      }

      console.log(`[MCP] Using Session ID: ${this.mcpSessionId}`);

      const requestBody = {
        "jsonrpc": "2.0",
        "id": Date.now(),
        "method": "tools/call",
        "params": {
          "name": "search_cloudflare_documentation",
          "arguments": {
            "query": userQuery
          }
        }
      };

      console.log(`[MCP] Request Body:`, JSON.stringify(requestBody));

      // Create SSE connection to receive response
      const responsePromise = new Promise<any>((resolve, reject) => {
        const sseUrl = `https://docs.mcp.cloudflare.com/sse?sessionId=${this.mcpSessionId}`;
        console.log('[MCP] SSE URL:', sseUrl);
        
        fetch(sseUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        }).then(async (sseResponse) => {
          console.log('[MCP] SSE Response Status:', sseResponse.status);
          
          if (!sseResponse.ok) {
            const errorBody = await sseResponse.text();
            console.error('[MCP] SSE Connection Failed:', errorBody);
            reject(new Error(`SSE connection failed: ${sseResponse.status}`));
            return;
          }
          
          console.log('[MCP] SSE connection established, reading stream...');
          const reader = sseResponse.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process complete events
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            
            for (const event of events) {
              if (!event.trim()) continue;
              
              const lines = event.trim().split('\n');
              let eventType = '';
              let eventData = '';
              
              for (const line of lines) {
                if (line.startsWith('event: ')) {
                  eventType = line.substring(7);
                } else if (line.startsWith('data: ')) {
                  eventData = line.substring(6);
                }
              }
              
              if (eventType === 'message' && eventData) {
                try {
                  const parsed = JSON.parse(eventData);
                  console.log('[MCP] Received message via SSE');
                  reader.cancel();
                  resolve(parsed);
                  return;
                } catch (e) {
                  console.error('[MCP] Failed to parse SSE data:', e);
                }
              }
            }
          }
        }).catch(error => {
          console.error('[MCP] SSE fetch error:', error);
          reject(error);
        });
        
        // Timeout
        setTimeout(() => {
          console.error('[MCP] SSE timeout reached');
          reject(new Error('SSE response timeout'));
        }, 30000);
      });
      
      // Send the MCP request
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay
      
      console.log('[MCP] Sending message request...');
      const messageUrl = `https://docs.mcp.cloudflare.com/sse/message?sessionId=${this.mcpSessionId}`;
      
      const mcpResponse = await fetch(messageUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`[MCP] Response Status: ${mcpResponse.status}`);
      
      if (mcpResponse.status !== 202) {
        const responseText = await mcpResponse.text();
        console.error('[MCP] Request failed:', responseText);
        throw new Error(`MCP request failed: ${mcpResponse.status}`);
      }
      
      console.log('[MCP] Request accepted, waiting for SSE response...');
      
      // Wait for MCP response
      const mcpData = await Promise.race([
        responsePromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('MCP timeout after 30s')), 30000)
        )
      ]);
      
      console.log('[MCP] Response received');
      const searchResults = mcpData.result?.content?.[0]?.text || "";
      
      if (!searchResults || searchResults.length < 10) {
        throw new Error('MCP returned empty search results');
      }
      
      console.log(`[MCP] Search results length: ${searchResults.length}`);
      
      // Use AI to synthesize response with search results
      console.log('[AI] Synthesizing response with MCP results...');
      
      const conversationHistory = [
        {
          role: "system" as const,
          content: `You are CF Helper, a Cloudflare expert assistant. Use the following Cloudflare documentation to answer the user's question comprehensively. Always cite specific sections when relevant.\n\nCloudflare Documentation:\n${searchResults.substring(0, 8000)}`
        },
        {
          role: "user" as const,
          content: userQuery
        }
      ];
      
      const aiResponse = await this.env.AI.run(selectedModel, {
        messages: conversationHistory,
      });
      
      return aiResponse.response || "I found some relevant Cloudflare documentation but couldn't process it properly. Please try rephrasing your question.";
      
    } catch (error) {
      console.error('[MCP] Error in handleMCPRequest:', error);
      return `I encountered an issue accessing Cloudflare documentation: ${error.message}. Please try again or disable MCP search for a general response.`;
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
        
        // Filter models based on available API keys (Cloudflare models always available)
        const availableModels = allModels.filter((model: any) => {
          // Cloudflare models are always available
          if (model.provider === 'cloudflare') {
            return true;
          }
          
          // Check if required API key is available
          if (model.requiresKey) {
            return !!(env as any)[model.requiresKey];
          }
          
          return false;
        });
        
        console.log(`Returning ${availableModels.length} available models`);
        
        // Return only the fields needed by the client
        const models = availableModels.map((model: any) => ({
          id: model.id,
          name: model.name,
          description: model.description || model.id,
        }));
        
        return new Response(JSON.stringify({ models }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Error fetching models:', error);
        return new Response(JSON.stringify({ 
          models: [{ 
            id: '@cf/meta/llama-4-scout-17b-16e-instruct', 
            name: 'Default Model',
            description: 'Fallback model - Setup needed'
          }],
          setupRequired: true
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Handle KV population setup
    if (url.pathname === '/cfhelper/api/setup' && request.method === 'POST') {
      try {
        const { email, apiKey, accountId } = await request.json();
        
        if (!email || !apiKey || !accountId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields: email, apiKey, accountId'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        console.log('Setting up KV with email:', email.replace(/(.{2}).*(@.*)/, '$1***$2'));
        console.log('API Key provided:', apiKey.substring(0, 6) + '***');
        
        // Validate credentials with Cloudflare API
        try {
          const validateResponse = await fetch(`https://api.cloudflare.com/client/v4/user`, {
            headers: {
              'X-Auth-Email': email,
              'X-Auth-Key': apiKey,
              'Content-Type': 'application/json'
            }
          });
          
          if (!validateResponse.ok) {
            throw new Error(`Invalid credentials: ${validateResponse.status} ${validateResponse.statusText}`);
          }
          
          const userData = await validateResponse.json();
          if (!(userData as any).success) {
            throw new Error('Cloudflare API authentication failed');
          }
          
          console.log('Credentials validated successfully');
          
          // Use hardcoded Cloudflare Workers AI models (known to work)
          const models = [
            {
              id: "@cf/meta/llama-4-scout-17b-16e-instruct",
              name: "Llama 4 Scout (17B)",
              description: "Meta's multimodal model with 16 experts - Default",
              provider: "cloudflare",
              default: true
            },
            {
              id: "@cf/meta/llama-3.1-8b-instruct",
              name: "Llama 3.1 (8B)",
              description: "Meta Llama 3.1 8B Instruct",
              provider: "cloudflare"
            },
            {
              id: "@cf/meta/llama-2-7b-chat-int8",
              name: "Llama 2 (7B)",
              description: "Quantized Llama 2 7B Chat - Fallback",
              provider: "cloudflare",
              fallback: true
            },
            {
              id: "@cf/microsoft/phi-2",
              name: "Phi-2",
              description: "Microsoft's efficient small language model",
              provider: "cloudflare"
            },
            {
              id: "@cf/qwen/qwen1.5-7b-chat-awq",
              name: "Qwen 1.5 (7B)",
              description: "Alibaba's Qwen 1.5 7B Chat - Multilingual",
              provider: "cloudflare"
            },
            {
              id: "@cf/qwen/qwen1.5-14b-chat-awq",
              name: "Qwen 1.5 (14B)",
              description: "Alibaba's Qwen 1.5 14B Chat - Larger multilingual",
              provider: "cloudflare"
            },
            {
              id: "@cf/mistral/mistral-7b-instruct-v0.1",
              name: "Mistral 7B",
              description: "Mistral AI's efficient 7B instruction model",
              provider: "cloudflare"
            }
          ];
          
          console.log('Using', models.length, 'hardcoded Cloudflare AI models');
          
          // Try to populate the KV namespace
          await env.KV_STORE.put('Models', JSON.stringify(models));
          console.log('Successfully populated KV with', models.length, 'models');
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Successfully populated KV namespace with AI models',
            modelCount: models.length,
            models: models.map((m: any) => ({ id: m.id, name: m.name }))
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
          
        } catch (apiError) {
          console.error('Failed to validate credentials or populate KV:', apiError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to validate credentials or populate KV',
            details: (apiError as Error).message
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
      } catch (error) {
        console.error('Setup endpoint error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid request format'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Handle Step 2: WAF Rule Creation
    if (url.pathname === '/cfhelper/api/setup-waf' && request.method === 'POST') {
      try {
        const { email, apiKey, accountId, zoneId } = await request.json();
        
        if (!email || !apiKey || !accountId || !zoneId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields: email, apiKey, accountId, zoneId'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        console.log('Creating WAF rule for zone:', zoneId);
        console.log('Using email:', email.replace(/(.{2}).*(@.*)/, '$1***$2'));
        
        try {
          // Create WAF rule to block /api/waftesting
          const wafRuleResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/firewall/rules`, {
            method: 'POST',
            headers: {
              'X-Auth-Email': email,
              'X-Auth-Key': apiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: 'SE Onboarding - Block WAF Testing Endpoint',
              action: 'block',
              expression: '(http.request.uri.path eq "/api/waftesting")',
              description: 'Learning WAF rule created in SE Onboarding Step 2'
            })
          });
          
          if (!wafRuleResponse.ok) {
            throw new Error(`WAF Rule API error: ${wafRuleResponse.status} ${wafRuleResponse.statusText}`);
          }
          
          const wafData = await wafRuleResponse.json();
          if (!(wafData as any).success) {
            throw new Error('Failed to create WAF rule: ' + JSON.stringify((wafData as any).errors));
          }
          
          console.log('WAF rule created successfully:', (wafData as any).result?.id);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'WAF rule created successfully! /api/waftesting is now blocked',
            ruleId: (wafData as any).result?.id,
            ruleName: 'SE Onboarding - Block WAF Testing Endpoint'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
          
        } catch (wafError) {
          console.error('Failed to create WAF rule:', wafError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to create WAF rule',
            details: (wafError as Error).message
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
      } catch (error) {
        console.error('Setup WAF endpoint error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid request format'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Handle WAF testing endpoint (will be blocked by WAF rule in Step 2)
    if (url.pathname === '/api/waftesting' && request.method === 'GET') {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>SE Onboarding - WAF Testing</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              margin: 0;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: rgba(255,255,255,0.1); 
              padding: 40px; 
              border-radius: 15px; 
              backdrop-filter: blur(10px);
            }
            h1 { font-size: 2.5em; margin-bottom: 20px; }
            p { font-size: 1.2em; line-height: 1.6; }
            .success { color: #4CAF50; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎉 Congratulations!</h1>
            <p class="success">Glad you joined the team!</p>
            <p>You've successfully accessed the WAF testing endpoint.</p>
            <p><strong>Note:</strong> After completing SE Learning Step 2, this endpoint will be blocked by a WAF rule, and you'll see the Cloudflare security page instead.</p>
            <hr style="margin: 30px 0; border: 1px solid rgba(255,255,255,0.3);">
            <p><em>SE Onboarding Lab - Learning Cloudflare Security</em></p>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // Handle WebSocket upgrade for chat
    if (url.pathname === '/cfhelper/api/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }
      
      const roomId = url.searchParams.get('room') || 'default';
      const durableObjectId = env.SeOnboardingChat.idFromName(roomId);
      const durableObject = env.SeOnboardingChat.get(durableObjectId);
      
      return durableObject.fetch(request);
    }
    
    // Serve static assets
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
