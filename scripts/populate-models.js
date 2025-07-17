// Script to populate the KV namespace with model configuration

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
    id: "@cf/meta/llama-3.1-70b-instruct",
    name: "Llama 3.1 (70B)",
    description: "Meta Llama 3.1 70B Instruct - Larger model",
    provider: "cloudflare"
  },
  {
    id: "@cf/meta/llama-2-7b-chat-int8",
    name: "Llama 2 (7B)",
    description: "Quantized Llama 2 7B Chat - Reliable fallback",
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

console.log('🤖 AI Models for SE Onboarding Lab');
console.log('=====================================');
console.log(`Total models: ${models.length}`);
console.log('✨ All models are BUILT-IN to the server - no setup required!');
console.log('KV population is OPTIONAL (models work without it)\n');

models.forEach((model, index) => {
  console.log(`${index + 1}. ${model.name} (${model.id})`);
  console.log(`   ${model.description}`);
  if (model.default) console.log('   ⭐ DEFAULT MODEL');
  if (model.fallback) console.log('   🛡️ FALLBACK MODEL');
  console.log('');
});

console.log('📝 OPTIONAL: TO POPULATE KV NAMESPACE');
console.log('========================================');
console.log('(Models work automatically without this step)');
console.log('Only needed if you want to customize the model list:\n');

// Option 1: Using binding name (recommended for Deploy to Cloudflare)
console.log('1. Using KV binding name (works after Deploy to Cloudflare):');
console.log('   npx wrangler kv key put --binding="KV_STORE" "Models" \'');
console.log('   ' + JSON.stringify(models));
console.log('   \'\n');

// Option 2: Using namespace ID (if you know it)
console.log('2. Using namespace ID (replace YOUR_NAMESPACE_ID):');
console.log('   npx wrangler kv key put --namespace-id="YOUR_NAMESPACE_ID" "Models" \'');
console.log('   ' + JSON.stringify(models));
console.log('   \'\n');

// Option 3: List namespaces first
console.log('3. To find your namespace ID first:');
console.log('   npx wrangler kv namespace list');
console.log('   (Look for "KV_STORE" or similar name)\n');

console.log('💡 TIP: The Deploy to Cloudflare button works immediately!');
console.log('    All models are built-in - no KV setup required.');

// Export for programmatic use
module.exports = models;