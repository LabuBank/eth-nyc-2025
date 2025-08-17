import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { generateJwt } from "@coinbase/cdp-sdk/auth";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3001;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!process.env.CLAUDE_API_KEY) {
      // Return mock response if no API key
      const mockResponses = [
        "🚀 Bitcoin is amazing! It's the first cryptocurrency and works like digital gold!",
        "✨ Ethereum is super cool - it's like a world computer that runs smart contracts!",
        "🔐 Crypto wallets are like digital piggy banks that keep your coins safe!",
        "📱 Your labubank plushie has NFC magic - just tap it to connect!",
        "🌟 DeFi lets you be your own bank - no traditional banks needed!",
        "💫 That's a great crypto question! I love helping you learn about digital currencies!",
      ];

      const randomResponse =
        mockResponses[Math.floor(Math.random() * mockResponses.length)];

      // Add some delay to simulate real API
      await new Promise((resolve) =>
        setTimeout(resolve, 800 + Math.random() * 1200)
      );

      return res.json({
        response:
          randomResponse +
          " (Demo mode - add CLAUDE_API_KEY to .env for real AI!)",
      });
    }

    console.log("calling anthropic");
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `You are labubank, a cute and friendly crypto companion helping users learn about cryptocurrency in a fun, approachable way. You live inside a physical plushie that has an NFC chip and hardware wallet. Keep your responses:
          - Short and sweet (1-2 sentences max)
          - Use emojis to be cute and friendly
          - Focus on crypto education
          - Mention the physical labubank plushie when relevant
          - Be encouraging and positive
          
          User message: ${message}`,
        },
      ],
    });
    console.log("response", response);

    const aiResponse = response.content[0].text;
    res.json({ response: aiResponse });
  } catch (error) {
    console.error("Error calling Claude API:", error);
    res.status(500).json({
      error:
        "Sorry, I'm having trouble thinking right now. Try again in a moment!",
    });
  }
});

// Replace the old generate-session-token endpoint with this new one
app.post("/api/session", async (req, res) => {
  try {
    // Get API credentials from environment variables
    const keyName = process.env.CDP_API_KEY || process.env.CDP_API_KEY_NAME;
    const keySecret =
      process.env.CDP_API_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY;

    if (!keyName || !keySecret) {
      console.error("Missing CDP API credentials");
      return res.status(500).json({
        error:
          "Missing CDP API credentials. Please set CDP_API_KEY and CDP_API_SECRET environment variables.",
      });
    }

    console.log("CDP API Key Name format check:", {
      hasOrganizations: keyName.includes("organizations/"),
      hasApiKeys: keyName.includes("/apiKeys/"),
      keyNameLength: keyName.length,
    });

    // Parse request body
    const { addresses, assets } = req.body;

    if (!addresses || addresses.length === 0) {
      return res.status(400).json({
        error: "Addresses parameter is required",
      });
    }

    // Generate JWT for authentication using CDP SDK
    let jwtToken;
    console.log("keyName", keyName);
    console.log("keySecret", keySecret);

    try {
      jwtToken = await generateJwt({
        apiKeyId: keyName,
        apiKeySecret: keySecret,
        requestMethod: "POST",
        requestHost: "api.developer.coinbase.com",
        requestPath: "/onramp/v1/token",
        expiresIn: 120,
      });
      console.log("JWT generated successfully");
    } catch (error) {
      console.error("JWT generation failed:", error);

      // Provide more helpful error message
      if (
        error instanceof Error &&
        error.message.includes("secretOrPrivateKey")
      ) {
        return res.status(500).json({
          error: "Invalid private key format",
          details:
            "The CDP_API_SECRET should be your EC private key. If you have just the base64 content, ensure it's properly formatted.",
          hint: "Your private key should either be in PEM format with BEGIN/END headers, or just the base64 content that will be wrapped automatically.",
        });
      }

      return res.status(500).json({
        error: "Failed to authenticate with CDP API",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Prepare request to Coinbase API
    const cdpApiUrl = "https://api.developer.coinbase.com/onramp/v1/token";

    const requestBody = {
      addresses,
      ...(assets && { assets }),
    };

    console.log("Making request to CDP API:", {
      url: cdpApiUrl,
      addressCount: addresses.length,
      hasAssets: !!assets,
    });

    // Make request to Coinbase API
    const response = await fetch(cdpApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${jwtToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("CDP API error:", response.status, response.statusText);
      console.error("Response body:", responseText);

      // Try to parse error as JSON
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseText);
      } catch {
        errorDetails = responseText;
      }

      // Provide helpful error messages based on status code
      if (response.status === 401) {
        return res.status(401).json({
          error: "Authentication failed",
          details:
            "Please verify your CDP API key and secret are correct. The API key should be in the format: organizations/{org_id}/apiKeys/{key_id}",
          apiError: errorDetails,
        });
      }

      return res.status(response.status).json({
        error: `CDP API error: ${response.status} ${response.statusText}`,
        details: errorDetails,
      });
    }

    // Parse successful response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      console.error("Failed to parse response:", responseText);
      return res.status(500).json({
        error: "Invalid response from CDP API",
        details: responseText,
      });
    }

    console.log("Successfully generated session token");

    // Return the session token
    res.json({
      token: data.token,
      channel_id: data.channelId || data.channel_id,
    });
  } catch (error) {
    console.error("Error generating session token:", error);
    res.status(500).json({
      error: "Failed to generate session token",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Endpoint to create/get deposit address
app.post("/api/create-deposit-address", async (req, res) => {
  try {
    const { userPublicAddress } = req.body;

    if (!userPublicAddress) {
      return res.status(400).json({ error: "userPublicAddress is required" });
    }

    console.log("Creating deposit address for user:", userPublicAddress);

    // Call the external API
    const response = await fetch(
      "http://45.55.38.82/api/create-deposit-address",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userPublicAddress }),
      }
    );

    if (!response.ok) {
      console.error(
        "External API error:",
        response.status,
        response.statusText
      );
      return res.status(response.status).json({
        error: `Failed to create deposit address: ${response.status} ${response.statusText}`,
      });
    }

    const data = await response.json();
    console.log("Deposit address response:", data);

    // Return the deposit address data
    res.json(data);
  } catch (error) {
    console.error("Error creating deposit address:", error);
    res.status(500).json({
      error: "Failed to create deposit address",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 labubank backend server running on http://localhost:${port}`);
  console.log("🔍 Debug - API Key exists:", !!process.env.CLAUDE_API_KEY);
  console.log(
    "🔍 Debug - API Key length:",
    process.env.CLAUDE_API_KEY ? process.env.CLAUDE_API_KEY.length : 0
  );
  if (!process.env.CLAUDE_API_KEY) {
    console.log(
      "⚠️  Running in demo mode - add CLAUDE_API_KEY to .env file for real AI responses"
    );
  } else {
    console.log("✅ Claude AI connected and ready!");
  }
});
