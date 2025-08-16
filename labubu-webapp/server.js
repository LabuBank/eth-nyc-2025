const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
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