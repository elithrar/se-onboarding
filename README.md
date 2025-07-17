# SE Onboarding Lab

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/taslabs-net/seonboardinglab)

A modern chat application showcasing **Cloudflare's Developer Platform** - built entirely on the edge with Workers, AI, Durable Objects, and KV storage.

## What This Demonstrates
 
**Workers AI** - 8 built-in models (Llama, Phi, Qwen, Mistral) with zero setup required  
**Cloudflare Workers** - Serverless functions running in 300+ locations worldwide  
**Durable Objects** - Stateful computing for real-time WebSocket chat sessions  
**Workers KV** - Global key-value storage for lightning-fast model metadata  
**Modern Stack** - React + TypeScript with beautiful UI and dark/light themes  

## Perfect For

- **Sales Engineering demos** - Show the full Cloudflare developer platform
- **Developer onboarding** - Learn Workers, AI, and Durable Objects hands-on
- **Architecture reference** - See real-world implementation patterns
- **Customer showcases** - Demonstrate edge computing capabilities

## One-Click Deploy

Click the **Deploy to Cloudflare** button above for instant deployment!

## Architecture Deep Dive

### Direct Workers AI Integration
```typescript
// No external APIs, no API keys - just Workers AI runtime!
const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
  prompt: userMessage,
  max_tokens: 512,
  temperature: 0.7
});
```

### Real-Time Chat with Durable Objects
- **Persistent State**: Each chat room is a globally consistent Durable Object
- **WebSocket Magic**: Real-time message broadcasting with PartyKit integration
- **Edge Performance**: Sub-100ms response times worldwide

### Smart Model Storage
- **KV-Powered**: Model metadata cached at the edge
- **Dynamic Loading**: Add new models without code changes
- **Fast Enumeration**: `/cfhelper/api/models` endpoint for instant model discovery

## Key Features

**12+ AI Models** - Llama, Phi, Qwen, and more  
**Real-Time Chat** - WebSocket-powered instant messaging  
**Zero Cold Starts** - Durable Objects keep sessions warm  
**Global Edge** - 300+ locations, <50ms latency  
**No External APIs** - Pure Cloudflare platform showcase  
**Mobile Responsive** - Works perfectly on all devices  
**Dark/Light Themes** - Beautiful UI with automatic theme detection  
**Educational Info Page** - Built-in architecture explanation  

## Development

```bash
# Local development
npm run dev

# Build for production
npm run build

# Deploy to staging
wrangler deploy --env staging
```



## Contributing

Contributions welcome! This project is designed to showcase Cloudflare's platform capabilities.

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Documentation

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Workers KV](https://developers.cloudflare.com/kv/)

