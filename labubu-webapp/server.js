const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = 3001;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.CLAUDE_API_KEY) {
      // Return mock response if no API key
      const mockResponses = [
        "🚀 Bitcoin is amazing! It's the first cryptocurrency and works like digital gold!",
        "✨ Ethereum is super cool - it's like a world computer that runs smart contracts!",
        "🔐 Crypto wallets are like digital piggy banks that keep your coins safe!",
        "📱 Your Labubu plushie has NFC magic - just tap it to connect!",
        "🌟 DeFi lets you be your own bank - no traditional banks needed!",
        "💫 That's a great crypto question! I love helping you learn about digital currencies!"
      ];
      
      const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      
      // Add some delay to simulate real API
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
      
      return res.json({ 
        response: randomResponse + " (Demo mode - add CLAUDE_API_KEY to .env for real AI!)"
      });
    }


    console.log('calling anthropic');
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `You are Labubu, a cute and friendly crypto companion helping users learn about cryptocurrency in a fun, approachable way. You live inside a physical plushie that has an NFC chip and hardware wallet. Keep your responses:
          - Short and sweet (1-2 sentences max)
          - Use emojis to be cute and friendly
          - Focus on crypto education
          - Mention the physical Labubu plushie when relevant
          - Be encouraging and positive
          
          User message: ${message}`
        }
      ]
    });
    console.log('response', response);

    const aiResponse = response.content[0].text;
    res.json({ response: aiResponse });

  } catch (error) {
    console.error('Error calling Claude API:', error);
    res.status(500).json({ 
      error: 'Sorry, I\'m having trouble thinking right now. Try again in a moment!' 
    });
  }
});

// Add this new endpoint for generating session tokens
app.post('/api/generate-session-token', async (req, res) => {
  try {
    // Check if CDP API key is configured
    if (!process.env.CDP_SECRET_API_KEY) {
      return res.status(500).json({ 
        error: 'CDP Secret API Key not configured. Add CDP_SECRET_API_KEY to your .env file.' 
      });
    }

    // Generate JWT for CDP authentication
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: process.env.CDP_SECRET_API_KEY,
      sub: process.env.CDP_SECRET_API_KEY,
      aud: 'https://api.developer.coinbase.com',
      iat: now,
      exp: now + 60, // 1 minute expiration
    };

    const jwtToken = jwt.sign(payload, process.env.CDP_SECRET_API_KEY, { algorithm: 'HS256' });

    // Generate session token using CDP API
    const sessionTokenResponse = await fetch('https://api.developer.coinbase.com/onramp/v1/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addresses: [
          {
            address: req.body.walletAddress || "0x4315d134aCd3221a02dD380ADE3aF39Ce219037c", // Default or user-provided address
            blockchains: ["ethereum", "base"]
          }
        ],
        assets: ["ETH", "USDC"]
      })
    });

    if (!sessionTokenResponse.ok) {
      const errorData = await sessionTokenResponse.text();
      console.error('CDP API Error:', errorData);
      throw new Error(`Failed to generate session token: ${sessionTokenResponse.status}`);
    }

    const sessionData = await sessionTokenResponse.json();
    
    res.json({ 
      sessionToken: sessionData.token,
      success: true 
    });

  } catch (error) {
    console.error('Error generating session token:', error);
    res.status(500).json({ 
      error: 'Failed to generate session token. Please try again.' 
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Labubu backend server running on http://localhost:${port}`);
  console.log('🔍 Debug - API Key exists:', !!process.env.CLAUDE_API_KEY);
  console.log('🔍 Debug - API Key length:', process.env.CLAUDE_API_KEY ? process.env.CLAUDE_API_KEY.length : 0);
  if (!process.env.CLAUDE_API_KEY) {
    console.log('⚠️  Running in demo mode - add CLAUDE_API_KEY to .env file for real AI responses');
  } else {
    console.log('✅ Claude AI connected and ready!');
  }
});