import { createRoot } from "react-dom/client";
import React, { useState, useEffect, useRef } from "react";

import {
  Message,
  ChatMessage,
  Message as MessageType,
} from "../shared";
// Using crypto.randomUUID() instead of nanoid to avoid external dependency

import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
  useNavigate,
  useLocation,
} from "react-router";

// SE Onboarding Lab - Clean version without Turnstile

// Simple content formatter for better readability
function MessageContent({ content }: { content: string }) {
  if (!content) {
    return <span>No content</span>;
  }

  // Format content with proper line breaks and basic formatting
  const formattedContent = content
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br />')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');

  return (
    <div 
      dangerouslySetInnerHTML={{ __html: `<p>${formattedContent}</p>` }} 
      className="markdown-content" 
      style={{ lineHeight: '1.6' }}
    />
  );
}

function SetupPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [email, setEmail] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [accountId, setAccountId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [setupStatus, setSetupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [modelCount, setModelCount] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [currentStepData, setCurrentStepData] = useState<any>({});
  
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !apiKey || !accountId) {
      setSetupStatus('error');
      setStatusMessage('Please fill in all fields');
      return;
    }
    
    setIsSubmitting(true);
    setSetupStatus('loading');
    setStatusMessage('Setting up AI models...');
    
    try {
      const response = await fetch('/cfhelper/api/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          apiKey,
          accountId
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSetupStatus('success');
        setModelCount(result.modelCount || 0);
        setStatusMessage(`Successfully populated KV with ${result.modelCount} AI models!`);
        setCompletedSteps([...completedSteps, 1]);
        
        // Clear sensitive data
        setEmail('');
        setApiKey('');
        setAccountId('');
      } else {
        setSetupStatus('error');
        setStatusMessage(result.error || 'Setup failed');
      }
    } catch (error) {
      setSetupStatus('error');
      setStatusMessage('Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="landing-page">
      <div className="setup-container" style={{ maxWidth: '1200px', display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
        {/* Left Column - Steps Checklist */}
        <div className="steps-sidebar" style={{ 
          flex: '0 0 300px', 
          background: 'rgba(255,255,255,0.1)', 
          borderRadius: '15px', 
          padding: '30px', 
          backdropFilter: 'blur(10px)',
          height: 'fit-content'
        }}>
          <h2 style={{ color: 'white', marginBottom: '20px', fontSize: '1.5em' }}>Setup Progress</h2>
          
          {[1, 2, 3, 4, 5, 6].map(step => (
            <div key={step} 
              className={`step-checkbox ${
                completedSteps.includes(step) ? 'completed' : 
                currentStep === step ? 'active' : 'pending'
              }`}
              style={{
                display: 'flex',
                alignItems: 'center', 
                padding: '12px',
                margin: '8px 0',
                borderRadius: '8px',
                background: completedSteps.includes(step) ? 'rgba(76, 175, 80, 0.2)' : 
                           currentStep === step ? 'rgba(255, 107, 53, 0.2)' : 
                           'rgba(255,255,255,0.05)',
                border: completedSteps.includes(step) ? '1px solid #4CAF50' :
                        currentStep === step ? '1px solid #FF6B35' :
                        '1px solid rgba(255,255,255,0.1)',
                cursor: step <= 2 ? 'pointer' : 'default'
              }}
              onClick={() => {
                if (step <= 2) setCurrentStep(step);
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: completedSteps.includes(step) ? '#4CAF50' : 
                           currentStep === step ? '#FF6B35' : 
                           'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold',
                marginRight: '12px'
              }}>
                {completedSteps.includes(step) ? '✓' : step}
              </div>
              <div style={{ color: 'white' }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                  {step === 1 && 'Setup AI Models'}
                  {step === 2 && 'Deploy WAF Rule'}
                  {step >= 3 && 'Coming Soon'}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  {step === 1 && 'KV Population'}
                  {step === 2 && 'Security Rules'}
                  {step >= 3 && ''}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Right Column - Content */}
        <div className="setup-content" style={{ 
          width: '600px',
          minWidth: '600px',
          maxWidth: '600px',
          background: 'rgba(255,255,255,0.1)', 
          borderRadius: '15px', 
          padding: '30px',
          backdropFilter: 'blur(10px)',
          height: '700px',
          maxHeight: '700px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ color: 'white', fontSize: '1.8em', marginBottom: '8px', textAlign: 'left' }}>
              {currentStep === 1 && 'Setup AI Models'}
              {currentStep === 2 && 'Deploy WAF Rule'} 
              {currentStep >= 3 && 'Coming Soon'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '24px', textAlign: 'left' }}>
              {currentStep === 1 && 'Populate your KV namespace with Cloudflare Workers AI models'}
              {currentStep === 2 && 'Create Web Application Firewall rules for security'}
              {currentStep >= 3 && 'This step will be available soon'}
            </p>
          </div>
        
        {setupStatus === 'idle' && currentStep === 1 && (
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '24px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="email" style={{ 
                  color: 'white', 
                  fontSize: '14px', 
                  fontWeight: '600',
                  marginBottom: '4px'
                }}>Cloudflare Email:</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your-email@example.com"
                  required
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '14px',
                    backdropFilter: 'blur(10px)',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '1px solid #FF6B35';
                    e.target.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid rgba(255,255,255,0.3)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="apiKey" style={{ 
                  color: 'white', 
                  fontSize: '14px', 
                  fontWeight: '600',
                  marginBottom: '4px'
                }}>Cloudflare API Key:</label>
                <input
                  type="password"
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Your Global API Key"
                  required
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '14px',
                    backdropFilter: 'blur(10px)',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '1px solid #FF6B35';
                    e.target.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid rgba(255,255,255,0.3)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <small style={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  fontSize: '12px',
                  fontStyle: 'italic'
                }}>Find this in Cloudflare Dashboard → My Profile → API Tokens</small>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="accountId" style={{ 
                  color: 'white', 
                  fontSize: '14px', 
                  fontWeight: '600',
                  marginBottom: '4px'
                }}>Account ID:</label>
                <input
                  type="text"
                  id="accountId"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="Your Account ID"
                  required
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '14px',
                    backdropFilter: 'blur(10px)',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '1px solid #FF6B35';
                    e.target.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid rgba(255,255,255,0.3)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <small style={{ 
                  color: 'rgba(255,255,255,0.7)', 
                  fontSize: '12px',
                  fontStyle: 'italic'
                }}>Find this in Cloudflare Dashboard → Right sidebar</small>
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                style={{
                  padding: '14px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSubmitting ? 'rgba(255, 107, 53, 0.5)' : '#FF6B35',
                  color: '#000',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  marginTop: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) {
                    e.target.style.background = '#FF8A65';
                    e.target.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting) {
                    e.target.style.background = '#FF6B35';
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
              >
                {isSubmitting ? 'Setting up...' : 'Setup AI Models'}
              </button>
            </form>
          </div>
        )}
        
        {setupStatus === 'idle' && currentStep === 2 && (
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '24px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            textAlign: 'center',

            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
            <h3 style={{ color: 'white', marginBottom: '12px' }}>WAF Rule Deployment</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.5 }}>
              Web Application Firewall rule creation requires additional Zone ID configuration.
              <br /><br />
              This feature will allow you to create security rules to block specific endpoints for testing.
            </p>
            <div style={{ 
              marginTop: '24px',
              padding: '16px',
              background: 'rgba(255, 107, 53, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 107, 53, 0.3)'
            }}>
              <p style={{ color: '#FF6B35', margin: 0, fontWeight: '500', fontSize: '14px' }}>
                🛠️ Coming in the next update!
              </p>
            </div>
          </div>
        )}
        
        {setupStatus === 'idle' && currentStep >= 3 && (
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '24px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            textAlign: 'center',

            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
            <h3 style={{ color: 'white', marginBottom: '12px' }}>Coming Soon</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              This step will be available in a future update.
            </p>
          </div>
        )}
        
        {setupStatus === 'loading' && (
          <div className="status-message loading">
            <div className="spinner"></div>
            <p>{statusMessage}</p>
            <p>Please wait while we configure your AI models...</p>
          </div>
        )}
        
        {setupStatus === 'success' && (
          <div className="status-message success">
            <div className="success-icon">✓</div>
            <h3>Setup Complete!</h3>
            <p>{statusMessage}</p>
            <p>Your chat application now has access to {modelCount} different AI models including Llama, Phi, Qwen, and Mistral.</p>
            <button 
              onClick={() => navigate('/')}
              className="start-button"
              style={{ marginTop: '20px' }}
            >
              Start Chatting →
            </button>
          </div>
        )}
        
        {setupStatus === 'error' && (
          <div className="status-message error">
            <div className="error-icon">⚠️</div>
            <h3>Setup Failed</h3>
            <p>{statusMessage}</p>
            <button 
              onClick={() => {
                setSetupStatus('idle');
                setStatusMessage('');
              }}
              className="start-button"
              style={{ marginTop: '20px' }}
            >
              Try Again
            </button>
          </div>
        )}
        
        <div style={{ 
          textAlign: 'center', 
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <button 
            onClick={() => navigate('/')}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyContent: 'center',
              margin: '0 auto'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255,255,255,0.2)';
              e.target.style.borderColor = 'rgba(255,255,255,0.5)';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255,255,255,0.1)';
              e.target.style.borderColor = 'rgba(255,255,255,0.3)';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            ← Back to Chat
          </button>
        </div>
          
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const [name, setName] = useState("");
  const [selectedModel, setSelectedModel] = useState("@cf/meta/llama-4-scout-17b-16e-instruct");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [models, setModels] = useState<Array<{id: string, name: string, description: string}>>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const navigate = useNavigate();

  // Fetch available models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/cfhelper/api/models');
        if (response.ok) {
          const data = await response.json();
          if (data.models && Array.isArray(data.models)) {
            setModels(data.models);
            console.log(`Loaded ${data.models.length} models from API`);
          } else {
            console.warn('Invalid models response format:', data);
          }
        } else {
          console.error('Failed to fetch models:', response.status);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      setIsSubmitting(true);
      // Generate a unique room ID and navigate with the name and model
      const roomId = crypto.randomUUID();
      navigate(`/chat/${roomId}?name=${encodeURIComponent(name.trim())}&model=${encodeURIComponent(selectedModel)}`);
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-content">
        <img src="/cloudflare-hero.png" alt="Cloudflare" className="landing-logo" />
        <h1>SE Onboarding Lab</h1>
        <p>Experience Cloudflare Workers AI Platform</p>
        
        <form onSubmit={handleSubmit} className="name-form">
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name..."
            className="name-input"
            autoFocus
          />
          
          <div className="model-selector">
            <label htmlFor="model">Select AI Model</label>
            <select
              id="model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="model-select"
              disabled={isLoadingModels}
            >
              {isLoadingModels ? (
                <option>Loading models...</option>
              ) : (
                models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))
              )}
            </select>
          </div>
          
          <button 
            type="submit" 
            className="start-button"
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? 'Starting...' : 'Start Chat'}
          </button>
          <p className="privacy-notice">Chats are not persistent</p>
        </form>
        
        <p className="built-by">Built with 🧡 for SE Onboarding</p>
        
        <div className="info-link">
          <a href="/setup" className="info-button">
            🚀 Next Steps
          </a>
        </div>
      </div>
    </div>
  );
}

function ChatRoom() {
  const { room } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get name and model from URL params
  const searchParams = new URLSearchParams(location.search);
  const userName = searchParams.get('name');
  const selectedModel = searchParams.get('model') || '@cf/meta/llama-4-scout-17b-16e-instruct';
  
  // MCP toggle state
  const [useMCP, setUseMCP] = useState(false);
  
  // Redirect to home on refresh or missing params
  React.useEffect(() => {
    if (!userName) {
      navigate('/', { replace: true });
    }
    
    // Always redirect to home on page refresh
    const handleBeforeUnload = () => {
      // Clear the current URL by replacing with home
      sessionStorage.setItem('cfhelper-should-redirect', 'true');
    };
    
    // Check if we should redirect (after page refresh)
    if (sessionStorage.getItem('cfhelper-should-redirect') === 'true') {
      sessionStorage.removeItem('cfhelper-should-redirect');
      navigate('/', { replace: true });
      return;
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userName, navigate]);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionStatus, setSessionStatus] = useState<'loading' | 'ready' | 'failed' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Use wss:// for production (workers.dev) and ws:// for local dev
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/cfhelper/api/ws?room=${room || 'default'}`;
    console.log('Connecting to WebSocket:', wsUrl);
    ws.current = new WebSocket(wsUrl);
    
    ws.current.addEventListener('open', () => {
      console.log('WebSocket connected');
      setSessionStatus('ready');
    });
    
    ws.current.addEventListener('message', (event) => {
      const message = JSON.parse(event.data as string) as MessageType;
      if (message.type === "add") {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      } else if (message.type === "all") {
        setMessages(message.messages);
        scrollToBottom();
      }
    });
    
    ws.current.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      setSessionStatus('failed');
    });
    
    ws.current.addEventListener('close', () => {
      console.log('WebSocket disconnected');
      setSessionStatus(null);
    });

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [room]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = (content: string) => {
    if (!content.trim()) return;

    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      user: userName || "Anonymous",
      role: "user",
      content: content.trim(),
    };

    // Don't add locally - let it come back via WebSocket to avoid duplicates
    ws.current?.send(
      JSON.stringify(
        {
          type: "add",
          ...chatMessage,
          model: selectedModel,
          platform: "docker",
          useMCP: useMCP,
        } satisfies Message),
    );
  };

  return (
    <div className="chat">
      <div className="chat-header">
        <div>
          <h3>SE Onboarding Lab Chat</h3>
          <div className="chat-header-subtitle">
            Experience Cloudflare Workers AI with {selectedModel.split('/').pop()} 
          </div>
        </div>
        <img 
          src="/cloudflare-hero.png" 
          alt="Cloudflare" 
          className="chat-header-logo"
        />
      </div>
      
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className="message">
            {message.role === "user" ? (
              <div className={`message-avatar ${message.role}`}>
                {message.user[0].toUpperCase()}
              </div>
            ) : (
              <img 
                src="/cloudflare-hero.png" 
                alt="SE Assistant" 
                className="message-avatar assistant"
              />
            )}
            <div className="message-content">
              <div className="message-username">
                {message.role === "user" ? message.user : "SE Onboarding Assistant"}
              </div>
              <div className="message-text">
                <MessageContent content={message.content} />
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-form">
        {/* MCP Toggle */}
        <div style={{ 
          padding: '12px 20px', 
          background: 'rgba(255,255,255,0.05)', 
          borderRadius: '12px', 
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <input 
            type="checkbox" 
            id="mcp-toggle" 
            checked={useMCP}
            onChange={(e) => setUseMCP(e.target.checked)}
            style={{
              width: '18px',
              height: '18px',
              accentColor: '#FF6B35',
              cursor: 'pointer'
            }}
          />
          <label 
            htmlFor="mcp-toggle" 
            style={{ 
              color: 'white', 
              fontSize: '14px', 
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>🔍</span>
            <span>Search <a 
              href="https://developers.cloudflare.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                color: '#FF6B35',
                textDecoration: 'none',
                fontWeight: '600'
              }}
              onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >Cloudflare Developer</a> Docs with <a 
              href="https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                color: '#FF6B35',
                textDecoration: 'none',
                fontWeight: '600'
              }}
              onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >MCP</a></span>
            {useMCP && <span style={{ color: '#FF6B35', fontSize: '12px', marginLeft: '8px' }}>✓ Active</span>}
          </label>
        </div>
        
        <div className="chat-input-wrapper">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const content = formData.get("content") as string;
              
              sendMessage(content);
              form.reset();
            }}

          >
            <textarea
              name="content"
              placeholder={`Ask anything about Cloudflare... (${selectedModel.split('/').pop()})`}
              className="chat-input"
              autoComplete="off"
              required
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const form = e.currentTarget.form;
                  if (form) {
                    const formData = new FormData(form);
                    const content = formData.get("content") as string;
                    if (content.trim()) {
                      sendMessage(content);
                      form.reset();
                    }
                  }
                }
              }}
            />
            <button type="submit" className="send-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22,2 15,22 11,13 2,9"></polygon>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/chat/:room" element={<ChatRoom />} />
      </Routes>
    </Router>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("No root element found");

const root = createRoot(container);
root.render(<App />);
