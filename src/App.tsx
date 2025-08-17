import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { getOnrampBuyUrl } from "@coinbase/onchainkit/fund";
import { createPublicClient, http, encodeFunctionData, parseAbi } from "viem";
import { mainnet } from "viem/chains";

function LabubankModel() {
  const { scene } = useGLTF("/labubank.glb");
  return <primitive object={scene} scale={3} />;
}

const LABUBANK_NFT_CONTRACT = "0x26E427f68355d97d7FDEb999A07348194D298415";
const SIGNATURE_API_BASE = "http://192.168.107.116";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const nftAbi = parseAbi([
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function setMyLabuBankName(uint256 _tokenId, string memory _newName) external",
  "function balanceOf(address owner) view returns (uint256)",
]);

async function getUserTokenId(userAddress: string): Promise<bigint | null> {
  try {
    const balance = await publicClient.readContract({
      address: LABUBANK_NFT_CONTRACT,
      abi: nftAbi,
      functionName: "balanceOf",
      args: [userAddress as `0x${string}`],
    });

    if (balance === BigInt(0)) {
      return null;
    }

    const tokenId = await publicClient.readContract({
      address: LABUBANK_NFT_CONTRACT,
      abi: nftAbi,
      functionName: "tokenOfOwnerByIndex",
      args: [userAddress as `0x${string}`, BigInt(0)],
    });

    return tokenId;
  } catch (error) {
    console.error("Error getting user token ID:", error);
    return null;
  }
}

async function getUserNonce(userAddress: string): Promise<string> {
  try {
    const nonce = await publicClient.getTransactionCount({
      address: userAddress as `0x${string}`,
    });
    return nonce.toString();
  } catch (error) {
    console.error("Error getting user nonce:", error);
    return "0";
  }
}

async function getSignatureFromAPI(txData: any): Promise<any> {
  try {
    const response = await fetch(`${SIGNATURE_API_BASE}/sign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(txData),
    });

    if (!response.ok) {
      throw new Error(`Signature API request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error calling signature API:", error);
    throw error;
  }
}

function generateSetNameCalldata(tokenId: bigint, newName: string): string {
  return encodeFunctionData({
    abi: nftAbi,
    functionName: "setMyLabuBankName",
    args: [tokenId, newName],
  });
}

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface PortfolioData {
  wallet_address: string;
  summary: string;
  portfolio_data: any;
}

interface CachedPortfolio {
  data: PortfolioData;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [labubuAddress, setLabubuAddress] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [isNaming, setIsNaming] = useState(false);
  const [labubankAddress, setlabubankAddress] = useState<string | null>(null);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(
    null
  );
  const [isPortfolioLoading, setIsPortfolioLoading] = useState(false);

  // Portfolio cache - in a real app, you might want to use localStorage or a more robust caching solution
  const portfolioCache = new Map<string, CachedPortfolio>();
  const CACHE_TTL = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

  const getCachedPortfolio = (walletAddress: string): PortfolioData | null => {
    const cached = portfolioCache.get(walletAddress);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      // Cache expired, remove it
      portfolioCache.delete(walletAddress);
      return null;
    }

    return cached.data;
  };

  const setCachedPortfolio = (walletAddress: string, data: PortfolioData) => {
    portfolioCache.set(walletAddress, {
      data,
      timestamp: Date.now(),
      ttl: CACHE_TTL,
    });
  };

  useEffect(() => {
    // Extract Ethereum address from URL path
    const path = window.location.pathname;
    const addressMatch = path.match(/\/(0x[a-fA-F0-9]{40})/);

    if (addressMatch) {
      const address = addressMatch[1];
      setlabubankAddress(address);
      // Fetch portfolio data when address is available
      fetchPortfolioData(address);
    }
  }, []);

  const fetchPortfolioData = async (walletAddress: string) => {
    // Check cache first
    const cachedData = getCachedPortfolio(walletAddress);
    if (cachedData) {
      console.log("📋 Using cached portfolio data for wallet:", walletAddress);
      setPortfolioData(cachedData);

      // Set the initial message with cached portfolio summary
      if (cachedData.summary) {
        const portfolioMessage: Message = {
          id: Date.now().toString(),
          text: `📊 Portfolio Summary (cached): ${cachedData.summary}`,
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages([portfolioMessage]);
      }
      return;
    }

    setIsPortfolioLoading(true);
    try {
      console.log("📤 Fetching portfolio data for wallet:", walletAddress);

      const response = await fetch(`http://159.203.68.59:8000/portfolio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
        }),
        // Note: fetch doesn't support timeout directly, but the server should handle it
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Portfolio response received:", data);
        setPortfolioData(data);

        // Cache the portfolio data
        setCachedPortfolio(walletAddress, data);

        // Set the initial message with portfolio summary
        if (data.summary) {
          const portfolioMessage: Message = {
            id: Date.now().toString(),
            text: `📊 Portfolio Summary: ${data.summary}`,
            sender: "ai",
            timestamp: new Date(),
          };
          setMessages([portfolioMessage]);
        } else {
          // Fallback if no summary
          const fallbackMessage: Message = {
            id: Date.now().toString(),
            text: "Hi! I'm your labubank companion. I've loaded your portfolio data. Ask me anything about crypto!",
            sender: "ai",
            timestamp: new Date(),
          };
          setMessages([fallbackMessage]);
        }
      } else {
        console.error(
          "❌ Portfolio query failed:",
          response.status,
          response.statusText
        );
        const errorText = await response.text();
        console.error("Response body:", errorText);

        // Set error message as initial message
        const errorMessage: Message = {
          id: Date.now().toString(),
          text: "Sorry, I couldn't fetch your portfolio data right now. But I'm still here to help with crypto questions! 🤖",
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages([errorMessage]);
      }
    } catch (error) {
      console.error("❌ Portfolio query failed:", error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: "Sorry, I couldn't fetch your portfolio data right now. But I'm still here to help with crypto questions! 🤖",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages([errorMessage]);
    } finally {
      setIsPortfolioLoading(false);
    }
  };

  const handleBuyCrypto = async () => {
    try {
      const projectId = process.env.REACT_APP_CDP_PROJECT_ID;
      console.log("projectId is", projectId);
      // Fallback to hardcoded address for testing
      const userPublicAddress =
        labubankAddress || "0x94544835Cf97c631f101c5f538787fE14E2E04f6";

      // Get the deposit address for this user
      console.log("Fetching deposit address for user:", userPublicAddress);
      const depositResponse = await fetch(
        "http://45.55.38.82/api/create-deposit-address",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userPublicAddress }),
        }
      );

      if (!depositResponse.ok) {
        throw new Error(
          `Failed to get deposit address: ${depositResponse.status}`
        );
      }

      const depositData = await depositResponse.json();
      console.log("Deposit address data:", depositData);
      const depositAddress = depositData.depositAddress;

      console.log("depositAddress is", depositAddress);

      // Generate session token dynamically using the new endpoint
      console.log(
        "Generating session token for deposit address:",
        depositAddress
      );
      const tokenResponse = await fetch(
        "http://45.55.38.82/api/generate-onramp-token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ depositAddress }),
        }
      );

      if (!tokenResponse.ok) {
        throw new Error(
          `Failed to generate session token: ${tokenResponse.status}`
        );
      }

      const tokenData = await tokenResponse.json();
      console.log("Generated session token data:", tokenData);
      const sessionToken = tokenData.token;

      const baseUrl = getOnrampBuyUrl({
        projectId: projectId as string,
        addresses: { [depositAddress]: ["ethereum"] },
        assets: ["USDC"],
        presetFiatAmount: 20,
        fiatCurrency: "USD",
      });

      // const sessionToken = "MWYwN2FmODAtYzY5OC02YmVhLTg4NDktN2U0NjdmMjlkZDQx";
      const onrampBuyUrl = `${baseUrl}&sessionToken=${sessionToken}`;
      window.open(
        onrampBuyUrl,
        "_blank",
        "width=500,height=700,scrollbars=yes,resizable=yes"
      );
    } catch (error) {
      console.error("Error opening Coinbase Pay:", error);
      alert("Failed to open Coinbase Pay. Please try again.");
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage("");
    setIsLoading(true);

    try {
      // Use the AI agent query endpoint instead of local chat API
      const response = await fetch("http://159.203.68.59:8000/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: currentInput,
          wallet_address:
            labubankAddress || "0x94544835Cf97c631f101c5f538787fE14E2E04f6",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text:
            data.answer ||
            "I'm sorry, I couldn't process that request. Please try again.",
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        // Log additional info for debugging
        if (data.used_tools) {
          console.log("Tools used:", data.used_tools);
        }
        if (data.tool_results) {
          console.log("Tool results keys:", Object.keys(data.tool_results));
        }
      } else {
        throw new Error(
          `Failed to get response from AI agent: ${response.status}`
        );
      }
    } catch (error) {
      console.error("Error sending message to AI agent:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I can't connect to my AI brain right now! Please try again in a moment. 🤖",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  const handleNameLabubank = async () => {
    if (!labubankAddress || !newName.trim()) return;

    setIsNaming(true);

    try {
      const tokenId = await getUserTokenId(labubankAddress!);

      if (tokenId === null) {
        alert("No Labubank NFT found for this address");
        return;
      }

      const calldata = generateSetNameCalldata(tokenId, newName);
      const nonce = await getUserNonce(labubankAddress!);

      const txData = {
        to: LABUBANK_NFT_CONTRACT,
        value: "0",
        data: calldata,
        gasLimit: "100000",
        gasPrice: "20000000000",
        nonce: nonce,
      };

      console.log("Requesting signature for transaction:", txData);
      const signatureResponse = await getSignatureFromAPI(txData);
      console.log("Received signature:", signatureResponse);

      const txHash = await publicClient.sendRawTransaction({
        serializedTransaction:
          signatureResponse.rawTransaction as `0x${string}`,
      });

      alert(`Transaction sent! Hash: ${txHash}`);
      setShowNameModal(false);
      setNewName("");
    } catch (error) {
      console.error("Error naming Labubank:", error);
      alert(
        `Failed to name Labubank: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsNaming(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #91BFDF, #E3D3E4, #E3C2D6, #E2B5BB)",
        color: "#B38079",
      }}
    >
      {/* Header */}
      <header style={{ padding: "16px", textAlign: "center" }}>
        <div style={{ marginBottom: "16px" }}>
          <img
            src="/labuBankLogoCropped.jpg"
            alt="LabuBank Logo"
            style={{
              height: "80px",
              width: "auto",
              borderRadius: "12px",
              boxShadow: "0 4px 15px rgba(179, 128, 121, 0.2)",
            }}
          />
        </div>
        <p className="labu-header-secondary">Your friendly crypto companion</p>
      </header>

      {/* labubank Address Display */}
      {labubankAddress && (
        <div
          style={{
            margin: "0 16px 16px",
            backgroundColor: "rgba(145, 191, 223, 0.9)",
            borderRadius: "16px",
            padding: "16px",
            boxShadow: "0 8px 25px rgba(179, 128, 121, 0.15)",
            border: "2px solid rgba(227, 194, 214, 0.3)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                fontSize: "1.5rem",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
              }}
            >
              🧸
            </span>
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "white",
                  margin: "0 0 4px 0",
                }}
              >
                Your labubank's Ethereum Address
              </p>
              <p
                style={{
                  fontSize: "16px",
                  fontFamily: "monospace",
                  color: "white",
                  margin: 0,
                  wordBreak: "break-all",
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backdropFilter: "blur(5px)",
                }}
              >
                {labubankAddress}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Loading Indicator */}
      {isPortfolioLoading && (
        <div
          style={{
            margin: "0 16px 16px",
            backgroundColor: "rgba(227, 194, 214, 0.8)",
            borderRadius: "16px",
            padding: "16px",
            textAlign: "center",
            color: "white",
          }}
        >
          <span style={{ fontSize: "1.2rem", marginRight: "8px" }}>⏳</span>
          Loading your portfolio data...
        </div>
      )}

      {/* 3D Model Container */}
      <div
        style={{
          height: "400px",
          margin: "0 16px 32px",
          backgroundColor: "rgba(227, 211, 228, 0.3)",
          borderRadius: "24px",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(227, 194, 214, 0.4)",
        }}
      >
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <ambientLight intensity={1.2} />
          <directionalLight position={[10, 10, 5]} intensity={2} />
          <directionalLight position={[-10, -10, -5]} intensity={1} />
          <pointLight position={[0, 10, 0]} intensity={1} />
          <Suspense fallback={null}>
            <LabubankModel />
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
      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            backgroundColor: "rgba(227, 211, 228, 0.9)",
            borderRadius: "16px",
            padding: "20px",
            boxShadow: "0 10px 30px rgba(179, 128, 121, 0.15)",
            color: "#B38079",
            maxHeight: "400px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h3 className="labu-header-tertiary">Chat with your Labubank</h3>

          {/* Messages Container */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              marginBottom: "16px",
              maxHeight: "280px",
              padding: "8px 0",
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  marginBottom: "16px",
                  display: "flex",
                  justifyContent:
                    message.sender === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: message.sender === "user" ? "80%" : "90%",
                    padding:
                      message.sender === "user" ? "10px 14px" : "16px 20px",
                    borderRadius: "18px",
                    backgroundColor:
                      message.sender === "user"
                        ? "#91BFDF"
                        : "rgba(227, 194, 214, 0.8)",
                    color: message.sender === "user" ? "white" : "#B38079",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    textAlign: message.sender === "user" ? "left" : "left",
                    overflowWrap: "break-word",
                    wordWrap: "break-word",
                    whiteSpace: "pre-wrap",
                    boxShadow:
                      message.sender === "user"
                        ? "0 2px 8px rgba(145, 191, 223, 0.3)"
                        : "0 2px 8px rgba(227, 194, 214, 0.3)",
                  }}
                >
                  {message.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "16px 20px",
                    borderRadius: "18px",
                    backgroundColor: "rgba(227, 194, 214, 0.6)",
                    color: "#B38079",
                    fontSize: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "16px" }}>⏳</span>
                  labubank is thinking...
                </div>
              </div>
            )}
          </div>

          {/* Input Container */}
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask labubank about crypto..."
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: "24px",
                border: "2px solid rgba(227, 194, 214, 0.5)",
                fontSize: "14px",
                outline: "none",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              style={{
                padding: "12px 20px",
                borderRadius: "24px",
                backgroundColor: "#91BFDF",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
                opacity: isLoading || !inputMessage.trim() ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div style={{ padding: "0 24px 32px" }}>
        <div
          style={{
            backgroundColor: "rgba(227, 211, 228, 0.95)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 10px 30px rgba(179, 128, 121, 0.15)",
            color: "#B38079",
          }}
        >
          <h2 className="labu-header-tertiary">Welcome to Crypto!</h2>
          <p className="labu-text">
            Tap your labubank plushie to start your crypto journey. Your digital
            companion will guide you through the world of cryptocurrency.
          </p>

          <div style={{ width: "100%" }}>
            <button
              onClick={handleBuyCrypto}
              style={{
                width: "100%",
                background:
                  "linear-gradient(135deg, #91BFDF, #E3C2D6, #E2B5BB)",
                color: "white",
                fontWeight: "bold",
                padding: "16px 24px",
                borderRadius: "12px",
                fontSize: "1.1rem",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 15px rgba(179, 128, 121, 0.3)",
              }}
            >
              💳 Buy USDC with Debit Card
            </button>
            <button
              onClick={() => setShowNameModal(true)}
              disabled={!labubankAddress}
              style={{
                width: "100%",
                background:
                  "linear-gradient(135deg, #E3C2D6, #91BFDF, #E2B5BB)",
                color: "white",
                fontWeight: "bold",
                padding: "16px 24px",
                borderRadius: "12px",
                fontSize: "1.1rem",
                border: "none",
                cursor: labubankAddress ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 15px rgba(179, 128, 121, 0.3)",
                marginTop: "12px",
                opacity: labubankAddress ? 1 : 0.5,
              }}
            >
              🏷️ Name my Labubank
            </button>
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                backgroundColor: "rgba(227, 194, 214, 0.4)",
                borderRadius: "8px",
                fontSize: "14px",
                color: "rgba(179, 128, 121, 0.9)",
              }}
            >
              <span className="labu-text">
                💡 Click above to buy USDC on Ethereum with your debit card via
                Coinbase Pay
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Name Modal */}
      {showNameModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "400px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
            }}
          >
            <h3
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                marginBottom: "16px",
                color: "#B38079",
                textAlign: "center",
              }}
            >
              Name Your Labubank
            </h3>

            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter a name for your Labubank..."
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "2px solid rgba(227, 194, 214, 0.5)",
                fontSize: "16px",
                outline: "none",
                marginBottom: "20px",
                boxSizing: "border-box",
              }}
              maxLength={50}
            />

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowNameModal(false);
                  setNewName("");
                }}
                disabled={isNaming}
                style={{
                  flex: 1,
                  padding: "12px 20px",
                  borderRadius: "12px",
                  backgroundColor: "#f0f0f0",
                  color: "#666",
                  border: "none",
                  cursor: isNaming ? "not-allowed" : "pointer",
                  fontSize: "16px",
                  fontWeight: "bold",
                  opacity: isNaming ? 0.5 : 1,
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleNameLabubank}
                disabled={isNaming || !newName.trim()}
                style={{
                  flex: 1,
                  padding: "12px 20px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #91BFDF, #E3C2D6)",
                  color: "white",
                  border: "none",
                  cursor:
                    isNaming || !newName.trim() ? "not-allowed" : "pointer",
                  fontSize: "16px",
                  fontWeight: "bold",
                  opacity: isNaming || !newName.trim() ? 0.5 : 1,
                }}
              >
                {isNaming ? "Naming..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
