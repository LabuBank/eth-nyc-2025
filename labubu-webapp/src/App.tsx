import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { getOnrampBuyUrl } from '@coinbase/onchainkit/fund';

function LabubuModel() {
  const { scene } = useGLTF('/model.glb');
  return <primitive object={scene} scale={3} />;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm your Labubu companion. Ask me anything about crypto!",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleBuyCrypto = async () => {
    try {
      const projectId = '615b11a0-4015-46f1-b809-4f3cafc9e32a';
      
      const baseUrl = getOnrampBuyUrl({
        projectId,
        addresses: { '0x1': ['ethereum'] },
        assets: ['USDC'],
        presetFiatAmount: 20,
        fiatCurrency: 'USD',
        // redirectUrl: 'https://yourapp.com/onramp-return?param=foo',
      });
      const onrampBuyUrl = `${baseUrl}&sessionToken=MWYwN2FkYzItODQ4Yi02OTIxLThhNDItOGVkYzg2ZDAyOGM3`;
      window.open(onrampBuyUrl, '_blank', 'width=500,height=700,scrollbars=yes,resizable=yes');
    } catch (error) {
      console.error('Error opening Coinbase Pay:', error);
      alert('Failed to open Coinbase Pay. Please try again.');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput
        })
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.response,
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error('Failed to get response from server');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I can't connect to my brain right now! Make sure the backend server is running. 🤖",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #a855f7, #ec4899, #ef4444)',
      color: 'white'
    }}>
      {/* Header */}
      <header style={{ padding: '16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px' }}>
          Labubu Crypto
        </h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>
          Your friendly crypto companion
        </p>
      </header>

      {/* 3D Model Container */}
      <div style={{
        height: '400px',
        margin: '0 16px 32px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <ambientLight intensity={1.2} />
          <directionalLight position={[10, 10, 5]} intensity={2} />
          <directionalLight position={[-10, -10, -5]} intensity={1} />
          <pointLight position={[0, 10, 0]} intensity={1} />
          <Suspense fallback={null}>
            <LabubuModel />
          </Suspense>
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate={true}
            autoRotateSpeed={2}
          />
        </Canvas>
      </div>

      {/* Chat Section */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
          color: '#1f2937',
          maxHeight: '300px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '16px' }}>
            Chat with Labubu
          </h3>

          {/* Messages Container */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            marginBottom: '16px',
            maxHeight: '180px'
          }}>
            {messages.map((message) => (
              <div key={message.id} style={{
                marginBottom: '12px',
                display: 'flex',
                justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: '18px',
                  backgroundColor: message.sender === 'user' ? '#a855f7' : '#f3f4f6',
                  color: message.sender === 'user' ? 'white' : '#1f2937',
                  fontSize: '14px',
                  lineHeight: '1.4'
                }}>
                  {message.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '18px',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  fontSize: '14px'
                }}>
                  Labubu is thinking...
                </div>
              </div>
            )}
          </div>

          {/* Input Container */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask Labubu about crypto..."
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '24px',
                border: '2px solid #e5e7eb',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              style={{
                padding: '12px 20px',
                borderRadius: '24px',
                backgroundColor: '#a855f7',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                opacity: isLoading || !inputMessage.trim() ? 0.5 : 1
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div style={{ padding: '0 24px 32px' }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
          color: '#1f2937'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '16px' }}>
            Welcome to Crypto!
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '24px', lineHeight: '1.6' }}>
            Tap your Labubu plushie to start your crypto journey. Your digital companion will guide you through the world of cryptocurrency.
          </p>

          <div style={{ width: '100%' }}>
            <button
              onClick={handleBuyCrypto}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                color: 'white',
                fontWeight: 'bold',
                padding: '16px 24px',
                borderRadius: '12px',
                fontSize: '1.1rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              💳 Buy USDC with Debit Card
            </button>

            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#6b7280'
            }}>
              <span>💡 Click above to buy USDC on Ethereum with your debit card via Coinbase Pay</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
