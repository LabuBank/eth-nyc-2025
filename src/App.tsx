import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { getOnrampBuyUrl } from '@coinbase/onchainkit/fund';
import { generateSessionToken, formatAddressesForToken } from './util/sessionTokenApi';

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
  const [labubuAddress, setLabubuAddress] = useState<string | null>(null);

  useEffect(() => {
    // Extract Ethereum address from URL path
    const path = window.location.pathname;
    const addressMatch = path.match(/\/(0x[a-fA-F0-9]{40})/);
    
    if (addressMatch) {
      setLabubuAddress(addressMatch[1]);
    }
  }, []);

  const handleBuyCrypto = async () => {
    try {
      const projectId = '615b11a0-4015-46f1-b809-4f3cafc9e32a';
      
      // const userAddress = '0x1234567890123456789012345678901234567890';
      // const networks = ['ethereum', 'base'];
      
      // const sessionToken = await generateSessionToken({
      //   addresses: formatAddressesForToken(userAddress, networks),
      //   assets: ['USDC', 'ETH']
      // });

      // console.log('sessionToken', sessionToken);

      const baseUrl = getOnrampBuyUrl({
        projectId,
        addresses: { '0x1': ['ethereum'] },
        assets: ['USDC'],
        presetFiatAmount: 20,
        fiatCurrency: 'USD',
      });
      const sessionToken = "MWYwN2FmMDctMDhiOS02YmJhLTk5MDQtMWEzYmNkOTZiNjZm";
      const onrampBuyUrl = `${baseUrl}&sessionToken=${sessionToken}`;
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
      background: 'linear-gradient(135deg, #91BFDF, #E3D3E4, #E3C2D6, #E2B5BB)',
      color: '#B38079'
    }}>
      {/* Header */}
      <header style={{ padding: '16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '8px', color: '#B38079' }}>
          Labubu Crypto
        </h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.8, color: '#B38079' }}>
          Your friendly crypto companion
        </p>
      </header>

      {/* Labubu Address Display */}
      {labubuAddress && (
        <div style={{
          margin: '0 16px 16px',
          backgroundColor: 'rgba(145, 191, 223, 0.9)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 8px 25px rgba(179, 128, 121, 0.15)',
          border: '2px solid rgba(227, 194, 214, 0.3)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <span style={{ 
              fontSize: '1.5rem',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
            }}>
              🧸
            </span>
            <div style={{ textAlign: 'center' }}>
              <p style={{ 
                fontSize: '14px', 
                fontWeight: 'bold', 
                color: 'white',
                margin: '0 0 4px 0'
              }}>
                Your Labubu's Ethereum Address
              </p>
              <p style={{ 
                fontSize: '16px', 
                fontFamily: 'monospace',
                color: 'white',
                margin: 0,
                wordBreak: 'break-all',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                padding: '8px 12px',
                borderRadius: '8px',
                backdropFilter: 'blur(5px)'
              }}>
                {labubuAddress}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3D Model Container */}
      <div style={{
        height: '400px',
        margin: '0 16px 32px',
        backgroundColor: 'rgba(227, 211, 228, 0.3)',
        borderRadius: '24px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(227, 194, 214, 0.4)'
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
          backgroundColor: 'rgba(227, 211, 228, 0.9)',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 10px 30px rgba(179, 128, 121, 0.15)',
          color: '#B38079',
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
                  backgroundColor: message.sender === 'user' ? '#91BFDF' : 'rgba(227, 194, 214, 0.8)',
                  color: message.sender === 'user' ? 'white' : '#B38079',
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
                  backgroundColor: 'rgba(227, 194, 214, 0.6)',
                  color: '#B38079',
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
                border: '2px solid rgba(227, 194, 214, 0.5)',
                fontSize: '14px',
                outline: 'none',
                backgroundColor: 'rgba(255, 255, 255, 0.8)'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              style={{
                padding: '12px 20px',
                borderRadius: '24px',
                backgroundColor: '#91BFDF',
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
          backgroundColor: 'rgba(227, 211, 228, 0.95)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 10px 30px rgba(179, 128, 121, 0.15)',
          color: '#B38079'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '16px' }}>
            Welcome to Crypto!
          </h2>
          <p style={{ color: 'rgba(179, 128, 121, 0.8)', marginBottom: '24px', lineHeight: '1.6' }}>
            Tap your Labubu plushie to start your crypto journey. Your digital companion will guide you through the world of cryptocurrency.
          </p>

          <div style={{ width: '100%' }}>
            <button
              onClick={handleBuyCrypto}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #91BFDF, #E3C2D6, #E2B5BB)',
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
                gap: '8px',
                boxShadow: '0 4px 15px rgba(179, 128, 121, 0.3)'
              }}
            >
              💳 Buy USDC with Debit Card
            </button>

            <div style={{
              marginTop: '12px',
              padding: '12px',
              backgroundColor: 'rgba(227, 194, 214, 0.4)',
              borderRadius: '8px',
              fontSize: '14px',
              color: 'rgba(179, 128, 121, 0.9)'
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
