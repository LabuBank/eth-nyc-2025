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
// trigger build again
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
        "📱 Your LabuBank plushie has NFC magic - just tap it to connect!",
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

// Add this new endpoint after the existing /api/session endpoint
app.post("/api/generate-onramp-token", async (req, res) => {
  try {
    const { depositAddress } = req.body;

    if (!depositAddress) {
      return res.status(400).json({ error: "depositAddress is required" });
    }

    console.log("Generating onramp token for deposit address:", depositAddress);

    // Prepare the request data for the script
    const requestData = JSON.stringify({
      addresses: [{ address: depositAddress, blockchains: ["ethereum"] }],
      assets: ["USDC"],
    });

    const keyData = {
      id: process.env.CDP_API_KEY_NAME,
      privateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
    };

    // Import fs to write the file
    const fs = await import("fs");

    // Write the key data to a file in the current directory (replace if exists)
    const keyFilePath = "./cdp_api_key.json";
    fs.writeFileSync(keyFilePath, JSON.stringify(keyData, null, 2));

    // Use child_process to execute the shell script
    const { spawn } = await import("child_process");

    return new Promise((resolve, reject) => {
      const scriptPath = "./src/script/get_onramp_token.sh";

      const child = spawn("bash", [scriptPath, keyFilePath], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Send the JSON data via stdin instead of command line argument
      child.stdin.write(requestData);
      child.stdin.end();

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        if (code !== 0) {
          console.error("Script execution failed:", stderr);
          return res.status(500).json({
            error: "Failed to generate onramp token",
            details: stderr,
          });
        }

        try {
          // Extract JSON from the script output (skip status line)
          const lines = stdout.trim().split("\n");
          const jsonLine = lines.find((line) => line.startsWith("{"));

          if (!jsonLine) {
            throw new Error("No JSON found in output");
          }

          const result = JSON.parse(jsonLine);
          console.log("Onramp token generated successfully");

          res.json({
            token: result.token,
            channelId: result.channelId || result.channel_id,
          });
        } catch (parseError) {
          console.error("Failed to parse script output:", stdout);
          res.status(500).json({
            error: "Invalid response from onramp token script",
            details: stdout,
          });
        }
      });

      child.on("error", (error) => {
        console.error("Script execution error:", error);
        res.status(500).json({
          error: "Failed to execute onramp token script",
          details: error.message,
        });
      });
    });
  } catch (error) {
    console.error("Error in generate-onramp-token endpoint:", error);
    res.status(500).json({
      error: "Failed to generate onramp token",
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
