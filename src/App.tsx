import React, { Suspense, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { getOnrampBuyUrl } from "@coinbase/onchainkit/fund";
import { createPublicClient, http, encodeFunctionData, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import PortfolioSection from "./components/PortfolioSection";
import LiquidGlass from "liquid-glass-react";

function LabubankModel() {
  const { scene } = useGLTF("/labubank.glb");
  return <primitive object={scene} scale={3} />;
}

const LABUBANK_NFT_CONTRACT = "0x26E427f68355d97d7FDEb999A07348194D298415";
const SIGNATURE_API_BASE = "http://192.168.107.116";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(
    "https://nd-489-221-744.p2pify.com/6179c84d7869593699be73681b4a96d9"
  ),
});

const nftAbi = parseAbi([
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function setMyLabuBankName(uint256 _tokenId, string memory _newName) external",
  "function balanceOf(address owner) view returns (uint256)",
  "function myLabuBankName(uint256 tokenId) view returns (string)",
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

async function getNFTName(userAddress: string): Promise<string | null> {
  try {
    const tokenId = await getUserTokenId(userAddress);

    if (tokenId === null) {
      return null;
    }

    const nftName = await publicClient.readContract({
      address: LABUBANK_NFT_CONTRACT,
      abi: nftAbi,
      functionName: "myLabuBankName",
      args: [tokenId],
    });

    return nftName || null;
  } catch (error) {
    console.error("Error getting NFT name:", error);
    return null;
  }
}

async function refreshNftNameWithRetry(
  walletAddress: string,
  maxRetries: number,
  currentNftName: string | null,
  setNftName: (name: string | null) => void
) {
  let attempts = 0;

  const tryFetch = async () => {
    attempts++;
    console.log(
      `Attempting to fetch NFT name (attempt ${attempts}/${maxRetries})`
    );

    try {
      const name = await getNFTName(walletAddress);
      if (name && name !== currentNftName) {
        // Name has been successfully updated
        setNftName(name);
        console.log("NFT name successfully updated:", name);
        return true;
      } else if (attempts < maxRetries) {
        // Name hasn't changed yet, retry after delay
        console.log("Name not updated yet, retrying in 3 seconds...");
        setTimeout(tryFetch, 3000);
        return false;
      } else {
        console.log("Max retries reached, name may not have updated");
        return false;
      }
    } catch (error) {
      console.error(`Error fetching NFT name (attempt ${attempts}):`, error);
      if (attempts < maxRetries) {
        setTimeout(tryFetch, 3000);
        return false;
      }
      return false;
    }
  };

  tryFetch();
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string>("");
  const [nftName, setNftName] = useState<string | null>(null);
  const [isLoadingNftName, setIsLoadingNftName] = useState(false);

  // Add ref to track if we've already started fetching portfolio data
  const hasStartedFetching = React.useRef(false);

  // Add state for mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

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

  const fetchNftName = async (walletAddress: string) => {
    setIsLoadingNftName(true);
    try {
      const name = await getNFTName(walletAddress);
      setNftName(name);
    } catch (error) {
      console.error("Error fetching NFT name:", error);
      setNftName(null);
    } finally {
      setIsLoadingNftName(false);
    }
  };

  useEffect(() => {
    console.log("🔄 useEffect triggered, checking for address...");
    // Extract Ethereum address from URL path
    const path = window.location.pathname;
    const addressMatch = path.match(/\/(0x[a-fA-F0-9]{40})/);

    if (addressMatch) {
      const address = addressMatch[1];
      console.log("📍 Found address in URL:", address);
      setlabubankAddress(address);
      // Fetch portfolio data when address is available
      fetchPortfolioData(address);
      // Fetch NFT name when address is available
      fetchNftName(address);
    } else {
      console.log("❌ No address found in URL path:", path);
    }
  }, []);

  // Add resize listener for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchPortfolioData = async (walletAddress: string) => {
    // Prevent multiple simultaneous requests using both state and ref
    if (isPortfolioLoading || hasStartedFetching.current) {
      console.log(
        "📋 Portfolio request already in progress or started, skipping...",
        {
          isPortfolioLoading,
          hasStartedFetching: hasStartedFetching.current,
        }
      );
      return;
    }

    // Mark that we've started fetching
    hasStartedFetching.current = true;
    console.log("🚀 Starting portfolio fetch for:", walletAddress);

    // Check cache first
    const cachedData = getCachedPortfolio(walletAddress);
    if (cachedData) {
      console.log("📋 Using cached portfolio data for wallet:", walletAddress);
      setPortfolioData(cachedData);
      hasStartedFetching.current = false; // Reset the flag

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
      hasStartedFetching.current = false; // Reset the flag when done
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
        "http://157.245.219.93:3001/api/generate-onramp-token",
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
          prompt: currentInput,
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

      setTransactionHash(txHash);
      setShowSuccessModal(true);
      setShowNameModal(false);
      setNewName("");
      // Refresh NFT name after transaction is mined (with retries)
      if (labubankAddress) {
        setTimeout(() => {
          refreshNftNameWithRetry(labubankAddress, 5, nftName, setNftName);
        }, 3000); // Wait 3 seconds for transaction to be mined
      }
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
        paddingBottom: "120px", // Add padding for fixed chat bar
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

      {/* Portfolio Section */}
      <PortfolioSection walletAddress={labubankAddress} />

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

      {/* NFT Name Display */}
      {labubankAddress && (
        <div
          style={{
            margin: "0 16px 32px",
            textAlign: "center",
          }}
        >
          {isLoadingNftName ? (
            <div
              style={{
                background:
                  "linear-gradient(135deg, #E3C2D6 0%, #91BFDF 50%, #E2B5BB 100%)",
                borderRadius: "20px",
                padding: "16px 24px",
                display: "inline-block",
                boxShadow: "0 8px 25px rgba(179, 128, 121, 0.2)",
                border: "2px solid rgba(255, 255, 255, 0.3)",
              }}
            >
              <span
                style={{
                  fontSize: "1.2rem",
                  color: "white",
                  fontWeight: "bold",
                }}
              >
                ✨ Loading your LabuBank's name... ✨
              </span>
            </div>
          ) : nftName ? (
            <div
              style={{
                background:
                  "linear-gradient(135deg, #91BFDF 0%, #E3C2D6 50%, #E2B5BB 100%)",
                borderRadius: "24px",
                padding: "20px 32px",
                display: "inline-block",
                boxShadow: "0 12px 35px rgba(179, 128, 121, 0.3)",
                border: "3px solid rgba(255, 255, 255, 0.4)",
                position: "relative",
                overflow: "hidden",
                animation: "pulse 3s infinite",
              }}
            >
              {/* Sparkle effects */}
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "12px",
                  fontSize: "1.5rem",
                  animation: "sparkle 2s infinite",
                }}
              >
                ✨
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: "8px",
                  left: "12px",
                  fontSize: "1.2rem",
                  animation: "sparkle 2s infinite 0.5s",
                }}
              >
                💫
              </div>
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  left: "20px",
                  fontSize: "1rem",
                  animation: "sparkle 2s infinite 1s",
                }}
              >
                ⭐
              </div>

              <div
                style={{
                  fontSize: "1rem",
                  color: "white",
                  marginBottom: "4px",
                  fontWeight: "600",
                }}
              >
                🎉 Meet Your LabuBank 🎉
              </div>

              <div
                style={{
                  fontSize: "2.2rem",
                  fontWeight: "bold",
                  color: "white",
                  textShadow: "0 3px 6px rgba(0, 0, 0, 0.3)",
                  letterSpacing: "1px",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                "{nftName}"
              </div>

              <div
                style={{
                  fontSize: "0.9rem",
                  color: "rgba(255, 255, 255, 0.9)",
                  marginTop: "4px",
                }}
              >
                🧸 Your personalized companion! 🧸
              </div>
            </div>
          ) : (
            <div
              style={{
                background:
                  "linear-gradient(135deg, #E2B5BB 0%, #E3C2D6 50%, #91BFDF 100%)",
                borderRadius: "20px",
                padding: "16px 24px",
                display: "inline-block",
                boxShadow: "0 8px 25px rgba(179, 128, 121, 0.2)",
                border: "2px solid rgba(255, 255, 255, 0.3)",
              }}
            >
              <span
                style={{
                  fontSize: "1.1rem",
                  color: "white",
                  fontWeight: "bold",
                }}
              >
                🏷️ Your LabuBank needs a name! Click "Name my Labubank" below 🏷️
              </span>
            </div>
          )}

          {/* CSS Animations */}
          <style>
            {`
              @keyframes pulse {
                0%, 100% {
                  transform: scale(1);
                  box-shadow: 0 12px 35px rgba(179, 128, 121, 0.3);
                }
                50% {
                  transform: scale(1.02);
                  box-shadow: 0 16px 45px rgba(179, 128, 121, 0.4);
                }
              }
              
              @keyframes sparkle {
                0%, 100% {
                  opacity: 0.7;
                  transform: scale(1) rotate(0deg);
                }
                50% {
                  opacity: 1;
                  transform: scale(1.2) rotate(180deg);
                }
              }
              
              @keyframes messageSlideIn {
                0% {
                  opacity: 0;
                  transform: translateX(20px) scale(0.9);
                }
                100% {
                  opacity: 1;
                  transform: translateX(0) scale(1);
                }
              }
              
              /* Mobile-specific styles for liquid glass */
              @media (max-width: 768px) {
                .liquid-glass-container {
                  touch-action: manipulation;
                  -webkit-tap-highlight-color: transparent;
                }
                
                /* Ensure text is readable on mobile */
                .liquid-glass-text {
                  font-size: 14px;
                  line-height: 1.5;
                  word-break: break-word;
                }
                
                /* Optimize scrolling for long messages */
                .liquid-glass-scroll {
                  -webkit-overflow-scrolling: touch;
                  scrollbar-width: thin;
                }
              }
              
              /* Touch-friendly interactions */
              @media (hover: none) and (pointer: coarse) {
                .liquid-glass-container {
                  transition: transform 0.2s ease;
                }
                
                .liquid-glass-container:active {
                  transform: scale(0.98);
                }
              }
            `}
          </style>
        </div>
      )}

      {/* Chat Messages Overlay */}
      <div style={{ position: "relative", pointerEvents: "none" }}>
        {messages.map((message, index) => (
          <div
            key={message.id}
            style={{
              position: "absolute",
              left: isMobile ? "50%" : "60%", // Center on mobile
              top: `${30 + index * 15}%`, // Stack messages vertically with spacing
              maxWidth: isMobile ? "90vw" : "280px", // Responsive width
              pointerEvents: "none",
              zIndex: 10,
              transform: isMobile ? "translateX(-50%)" : "none", // Center on mobile
            }}
          >
            {message.sender === "ai" && (
              <LiquidGlass
                displacementScale={isMobile ? 24 : 32}
                blurAmount={isMobile ? 0.06 : 0.08}
                saturation={isMobile ? 110 : 120}
                aberrationIntensity={isMobile ? 1.2 : 1.5}
                elasticity={isMobile ? 0.2 : 0.25}
                cornerRadius={isMobile ? 16 : 20}
                padding={isMobile ? "12px 16px" : "16px 20px"}
                className="liquid-glass-container"
                style={{
                  maxWidth: isMobile ? "90vw" : "280px",
                  width: "fit-content",
                }}
              >
                <div
                  className="liquid-glass-text liquid-glass-scroll"
                  style={{
                    color: "white",
                    fontSize: isMobile ? "13px" : "14px",
                    lineHeight: "1.6",
                    textAlign: "left",
                    overflowWrap: "break-word",
                    wordWrap: "break-word",
                    whiteSpace: "pre-wrap",
                    textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
                    animation: "messageSlideIn 0.5s ease-out",
                    maxHeight: isMobile ? "150px" : "200px", // Smaller height on mobile
                    overflowY: "auto", // Scroll for very long messages
                  }}
                >
                  {message.text}
                </div>
              </LiquidGlass>
            )}
          </div>
        ))}
        {isLoading && (
          <div
            style={{
              position: "absolute",
              left: isMobile ? "50%" : "60%",
              top: `${30 + messages.length * 15}%`,
              maxWidth: isMobile ? "90vw" : "280px",
              pointerEvents: "none",
              zIndex: 10,
              transform: isMobile ? "translateX(-50%)" : "none",
            }}
          >
            <LiquidGlass
              displacementScale={isMobile ? 24 : 32}
              blurAmount={isMobile ? 0.06 : 0.08}
              saturation={isMobile ? 110 : 120}
              aberrationIntensity={isMobile ? 1.2 : 1.5}
              elasticity={isMobile ? 0.2 : 0.25}
              cornerRadius={isMobile ? 16 : 20}
              padding={isMobile ? "12px 16px" : "16px 20px"}
              className="liquid-glass-container"
              style={{
                maxWidth: isMobile ? "90vw" : "280px",
                width: "fit-content",
              }}
            >
              <div
                className="liquid-glass-text"
                style={{
                  color: "white",
                  fontSize: isMobile ? "13px" : "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
                  animation: "messageSlideIn 0.5s ease-out",
                }}
              >
                <span style={{ fontSize: "16px" }}>⏳</span>
                labubank is thinking...
              </div>
            </LiquidGlass>
          </div>
        )}
      </div>

      {/* Chat Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "20px 16px 40px",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(145, 191, 223, 0.1) 50%, rgba(145, 191, 223, 0.3) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask LabuBank about crypto..."
            style={{
              flex: 1,
              padding: "16px 20px",
              borderRadius: "28px",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              fontSize: "16px",
              outline: "none",
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              color: "white",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputMessage.trim()}
            style={{
              padding: "16px 20px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #91BFDF, #E3C2D6)",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              fontWeight: "bold",
              opacity: isLoading || !inputMessage.trim() ? 0.5 : 1,
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
              transition: "all 0.3s ease",
              minWidth: "56px",
              minHeight: "56px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseOver={(e) => {
              if (!isLoading && inputMessage.trim()) {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.boxShadow =
                  "0 12px 40px rgba(0, 0, 0, 0.3)";
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.2)";
            }}
          >
            {isLoading ? "⏳" : "💬"}
          </button>
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

      {/* Success Modal */}
      {showSuccessModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(135deg, #91BFDF 0%, #E3C2D6 50%, #E2B5BB 100%)",
              borderRadius: "24px",
              padding: "32px",
              maxWidth: "450px",
              width: "100%",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Decorative background elements */}
            <div
              style={{
                position: "absolute",
                top: "-50px",
                right: "-50px",
                width: "100px",
                height: "100px",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "50%",
                filter: "blur(20px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "-30px",
                left: "-30px",
                width: "80px",
                height: "80px",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "50%",
                filter: "blur(15px)",
              }}
            />

            {/* Celebration Icons */}
            <div
              style={{
                fontSize: "4rem",
                marginBottom: "16px",
                animation: "bounce 2s infinite",
              }}
            >
              🎉✨🧸✨🎉
            </div>

            <h2
              style={{
                fontSize: "1.8rem",
                fontWeight: "bold",
                color: "white",
                marginBottom: "16px",
                textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                lineHeight: "1.3",
              }}
            >
              Congratulations!
            </h2>

            <p
              style={{
                fontSize: "1.1rem",
                color: "white",
                marginBottom: "24px",
                fontWeight: "500",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                lineHeight: "1.4",
              }}
            >
              You can now hang out with your personalized LabuBank!
            </p>

            {/* Transaction Link */}
            <a
              href={`https://etherscan.io/tx/${transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                color: "#B38079",
                padding: "12px 24px",
                borderRadius: "16px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: "bold",
                marginBottom: "24px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                transition: "all 0.3s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "white";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(255, 255, 255, 0.9)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              🔗 View Your Transaction
            </a>

            {/* Have Fun Button */}
            <div>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setTransactionHash("");
                  // Also refresh the NFT name when closing success modal
                  if (labubankAddress) {
                    fetchNftName(labubankAddress);
                  }
                }}
                style={{
                  background: "linear-gradient(135deg, #E3C2D6, #91BFDF)",
                  color: "white",
                  fontWeight: "bold",
                  padding: "16px 32px",
                  borderRadius: "20px",
                  fontSize: "1.1rem",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3)",
                  transition: "all 0.3s ease",
                  minWidth: "140px",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 25px rgba(0, 0, 0, 0.4)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 20px rgba(0, 0, 0, 0.3)";
                }}
              >
                🎈 Have fun!
              </button>
            </div>
          </div>

          {/* CSS Animation */}
          <style>
            {`
              @keyframes bounce {
                0%, 20%, 50%, 80%, 100% {
                  transform: translateY(0);
                }
                40% {
                  transform: translateY(-10px);
                }
                60% {
                  transform: translateY(-5px);
                }
              }
            `}
          </style>
        </div>
      )}
    </div>
  );
}

export default App;
