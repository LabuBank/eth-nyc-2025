import React, { Suspense, useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { getOnrampBuyUrl } from "@coinbase/onchainkit/fund";
import { createPublicClient, http, encodeFunctionData, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import PortfolioSection from "./components/PortfolioSection";

function LabubankModel() {
  const { scene } = useGLTF("/labubank.glb");
  return <primitive object={scene} scale={3} />;
}

const LABUBANK_NFT_CONTRACT = "0x26E427f68355d97d7FDEb999A07348194D298415";
const PYUSD_CONTRACT = "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8";
const SIGNATURE_API_BASE = "http://192.168.107.116";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http("https://nd-489-221-744.p2pify.com/6179c84d7869593699be73681b4a96d9"),
});

const nftAbi = parseAbi([
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function setMyLabuBankName(uint256 _tokenId, string memory _newName) external",
  "function balanceOf(address owner) view returns (uint256)",
  "function myLabuBankName(uint256 tokenId) view returns (string)",
]);

const erc20Abi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
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
    console.log(`Attempting to fetch NFT name (attempt ${attempts}/${maxRetries})`);
    
    try {
      const name = await getNFTName(walletAddress);
      if (name && name !== currentNftName) {
        setNftName(name);
        console.log("NFT name successfully updated:", name);
        return true;
      } else if (attempts < maxRetries) {
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
  ttl: number;
}

type OnboardingStep = 1 | 2 | 3;

function App() {
  // Onboarding state
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingProgress, setOnboardingProgress] = useState(33.33);
  
  // Existing states
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [isNaming, setIsNaming] = useState(false);
  const [labubankAddress, setlabubankAddress] = useState<string | null>(null);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [isPortfolioLoading, setIsPortfolioLoading] = useState(false);
  const [nftName, setNftName] = useState<string | null>(null);
  const [isLoadingNftName, setIsLoadingNftName] = useState(false);
  
  // Step 3 specific states
  const [isListeningForTransfer, setIsListeningForTransfer] = useState(false);
  const [pyUSDTransferDetected, setPyUSDTransferDetected] = useState(false);
  const [transferEventListener, setTransferEventListener] = useState<any>(null);

  // Portfolio cache
  const portfolioCache = new Map<string, CachedPortfolio>();
  const CACHE_TTL = 8 * 60 * 60 * 1000;

  const getCachedPortfolio = (walletAddress: string): PortfolioData | null => {
    const cached = portfolioCache.get(walletAddress);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
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

  // Step navigation functions
  const nextStep = () => {
    if (currentStep < 3) {
      const newStep = (currentStep + 1) as OnboardingStep;
      setCurrentStep(newStep);
      setOnboardingProgress(newStep * 33.33);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      const newStep = (currentStep - 1) as OnboardingStep;
      setCurrentStep(newStep);
      setOnboardingProgress(newStep * 33.33);
    }
  };

  const completeOnboarding = () => {
    setShowOnboarding(false);
    // Clean up any active listeners
    if (transferEventListener) {
      transferEventListener();
      setTransferEventListener(null);
    }
  };

  // pyUSD Transfer Event Listener
  const startTransferListener = async () => {
    if (!labubankAddress) return;
    
    setIsListeningForTransfer(true);
    
    try {
      const unwatch = publicClient.watchContractEvent({
        address: PYUSD_CONTRACT,
        abi: erc20Abi,
        eventName: 'Transfer',
        args: {
          to: labubankAddress as `0x${string}`,
        },
        onLogs: (logs) => {
          console.log('pyUSD Transfer detected!', logs);
          setPyUSDTransferDetected(true);
          setIsListeningForTransfer(false);
          // Auto-advance or show completion message
          setTimeout(() => {
            setPyUSDTransferDetected(false);
          }, 5000);
        },
      });
      
      setTransferEventListener(() => unwatch);
      
      // Stop listening after 10 minutes
      setTimeout(() => {
        if (unwatch) {
          unwatch();
          setIsListeningForTransfer(false);
          setTransferEventListener(null);
        }
      }, 10 * 60 * 1000);
      
    } catch (error) {
      console.error('Error setting up transfer listener:', error);
      setIsListeningForTransfer(false);
    }
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
    const path = window.location.pathname;
    const addressMatch = path.match(/\/(0x[a-fA-F0-9]{40})/);

    if (addressMatch) {
      const address = addressMatch[1];
      setlabubankAddress(address);
      fetchPortfolioData(address);
      fetchNftName(address);
    }
  }, []);

  const fetchPortfolioData = async (walletAddress: string) => {
    const cachedData = getCachedPortfolio(walletAddress);
    if (cachedData) {
      console.log("📋 Using cached portfolio data for wallet:", walletAddress);
      setPortfolioData(cachedData);

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
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Portfolio response received:", data);
        setPortfolioData(data);

        setCachedPortfolio(walletAddress, data);

        if (data.summary) {
          const portfolioMessage: Message = {
            id: Date.now().toString(),
            text: `📊 Portfolio Summary: ${data.summary}`,
            sender: "ai",
            timestamp: new Date(),
          };
          setMessages([portfolioMessage]);
        } else {
          const fallbackMessage: Message = {
            id: Date.now().toString(),
            text: "Hi! I'm your labubank companion. I've loaded your portfolio data. Ask me anything about crypto!",
            sender: "ai",
            timestamp: new Date(),
          };
          setMessages([fallbackMessage]);
        }
      } else {
        console.error("❌ Portfolio query failed:", response.status, response.statusText);
        const errorText = await response.text();
        console.error("Response body:", errorText);

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
      const userPublicAddress = labubankAddress || "0x94544835Cf97c631f101c5f538787fE14E2E04f6";

      console.log("Fetching deposit address for user:", userPublicAddress);
      const depositResponse = await fetch("http://45.55.38.82/api/create-deposit-address", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userPublicAddress }),
      });

      if (!depositResponse.ok) {
        throw new Error(`Failed to get deposit address: ${depositResponse.status}`);
      }

      const depositData = await depositResponse.json();
      console.log("Deposit address data:", depositData);
      const depositAddress = depositData.depositAddress;

      console.log("depositAddress is", depositAddress);

      console.log("Generating session token for deposit address:", depositAddress);
      const tokenResponse = await fetch("http://157.245.219.93:3001/api/generate-onramp-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ depositAddress }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Failed to generate session token: ${tokenResponse.status}`);
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

      const onrampBuyUrl = `${baseUrl}&sessionToken=${sessionToken}`;
      window.open(onrampBuyUrl, "_blank", "width=500,height=700,scrollbars=yes,resizable=yes");
      
      // Start listening for pyUSD transfers after opening onramp
      startTransferListener();
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
      const response = await fetch("http://159.203.68.59:8000/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: currentInput,
          wallet_address: labubankAddress || "0x94544835Cf97c631f101c5f538787fE14E2E04f6",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: data.answer || "I'm sorry, I couldn't process that request. Please try again.",
          sender: "ai",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        if (data.used_tools) {
          console.log("Tools used:", data.used_tools);
        }
        if (data.tool_results) {
          console.log("Tool results keys:", Object.keys(data.tool_results));
        }
      } else {
        throw new Error(`Failed to get response from AI agent: ${response.status}`);
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
        serializedTransaction: signatureResponse.rawTransaction as `0x${string}`,
      });

      setNewName("");
      if (labubankAddress) {
        setTimeout(() => {
          refreshNftNameWithRetry(labubankAddress, 5, nftName, setNftName);
        }, 3000);
      }
      
      // Show success and advance to next step after a brief delay
      setTimeout(() => {
        nextStep();
      }, 2000);
      
    } catch (error) {
      console.error("Error naming Labubank:", error);
      alert(`Failed to name Labubank: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsNaming(false);
    }
  };

  // Progress Bar Component
  const ProgressBar = ({ progress }: { progress: number }) => (
    <div
      style={{
        width: "100%",
        height: "8px",
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        borderRadius: "4px",
        overflow: "hidden",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: "100%",
          background: "linear-gradient(90deg, #91BFDF, #E3C2D6, #E2B5BB)",
          borderRadius: "4px",
          transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 2px 8px rgba(145, 191, 223, 0.4)",
        }}
      />
    </div>
  );

  // Loading Spinner Component
  const LoadingSpinner = () => (
    <div
      style={{
        display: "inline-block",
        width: "20px",
        height: "20px",
        border: "3px solid rgba(255, 255, 255, 0.3)",
        borderRadius: "50%",
        borderTopColor: "white",
        animation: "spin 1s ease-in-out infinite",
        marginRight: "8px",
      }}
    />
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #91BFDF, #E3D3E4, #E3C2D6, #E2B5BB)",
        color: "#B38079",
        position: "relative",
      }}
    >
      {/* Global CSS Animations */}
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(30px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateX(20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
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
          
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }
          
          @keyframes rotate {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          
          @keyframes celebration {
            0%, 100% {
              transform: scale(1);
            }
            25% {
              transform: scale(1.05);
            }
            50% {
              transform: scale(1.1);
            }
            75% {
              transform: scale(1.05);
            }
          }
          
          @keyframes spin {
            to {
              transform: rotate(360deg);
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
          
          .button-tap {
            transition: all 0.15s ease-in-out;
          }
          
          .button-tap:active {
            transform: scale(0.95);
          }
          
          @media (max-width: 768px) {
            .mobile-text {
              font-size: 0.9rem !important;
            }
            
            .mobile-button {
              padding: 14px 24px !important;
              font-size: 16px !important;
            }
            
            .mobile-modal {
              margin: 10px !important;
              max-width: calc(100vw - 20px) !important;
            }
          }
        `}
      </style>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
            padding: "20px",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            className="mobile-modal"
            style={{
              background: "linear-gradient(135deg, #91BFDF 0%, #E3C2D6 50%, #E2B5BB 100%)",
              borderRadius: "24px",
              padding: "32px",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)",
              position: "relative",
              animation: "slideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {/* Step Progress */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <p
                className="mobile-text"
                style={{
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: "600",
                  margin: "0 0 12px 0",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
                }}
              >
                Step {currentStep} of 3
              </p>
              <ProgressBar progress={onboardingProgress} />
            </div>

            {/* Step 1: Welcome */}
            {currentStep === 1 && (
              <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease-in-out" }}>
                <div
                  style={{
                    fontSize: "4rem",
                    marginBottom: "20px",
                    animation: "bounce 2s infinite",
                  }}
                >
                  🧸✨
                </div>
                <h2
                  style={{
                    fontSize: window.innerWidth < 768 ? "1.6rem" : "2rem",
                    fontWeight: "bold",
                    color: "white",
                    marginBottom: "16px",
                    textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                    lineHeight: "1.3",
                  }}
                >
                  Meet Your LabuBank!
                </h2>
                <p
                  className="mobile-text"
                  style={{
                    fontSize: "1.2rem",
                    color: "white",
                    marginBottom: "32px",
                    fontWeight: "500",
                    textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                    lineHeight: "1.5",
                  }}
                >
                  Your Friendly Crypto Companion!
                </p>
                <button
                  className="button-tap mobile-button"
                  onClick={nextStep}
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
                    minWidth: "200px",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.4)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3)";
                  }}
                >
                  🚀 Let's Get Started!
                </button>
              </div>
            )}

            {/* Step 2: Name Your LabuBank */}
            {currentStep === 2 && (
              <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease-in-out" }}>
                <div
                  style={{
                    fontSize: "3rem",
                    marginBottom: "20px",
                    animation: "pulse 2s infinite",
                  }}
                >
                  🏷️✨
                </div>
                <h2
                  style={{
                    fontSize: window.innerWidth < 768 ? "1.4rem" : "1.8rem",
                    fontWeight: "bold",
                    color: "white",
                    marginBottom: "16px",
                    textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                    lineHeight: "1.3",
                  }}
                >
                  Please give your LabuBank a nickname!
                </h2>
                <p
                  className="mobile-text"
                  style={{
                    fontSize: "1.1rem",
                    color: "white",
                    marginBottom: "24px",
                    fontWeight: "500",
                    textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                    lineHeight: "1.4",
                  }}
                >
                  They will guide you through your new financial journey
                </p>

                {nftName && (
                  <div
                    style={{
                      backgroundColor: "rgba(76, 175, 80, 0.9)",
                      color: "white",
                      padding: "12px 20px",
                      borderRadius: "12px",
                      marginBottom: "20px",
                      fontWeight: "bold",
                      animation: "celebration 1s ease-in-out",
                    }}
                  >
                    ✅ Named "{nftName}" successfully!
                  </div>
                )}

                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter a nickname..."
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    borderRadius: "16px",
                    border: "3px solid rgba(255, 255, 255, 0.4)",
                    fontSize: "18px",
                    outline: "none",
                    marginBottom: "24px",
                    boxSizing: "border-box",
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                  maxLength={20}
                />

                <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    className="button-tap"
                    onClick={prevStep}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "16px",
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: "white",
                      border: "2px solid rgba(255, 255, 255, 0.3)",
                      cursor: "pointer",
                      fontSize: "16px",
                      fontWeight: "bold",
                      transition: "all 0.3s ease",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
                    }}
                  >
                    ← Back
                  </button>

                  <button
                    className="button-tap mobile-button"
                    onClick={handleNameLabubank}
                    disabled={isNaming || !newName.trim() || !labubankAddress}
                    style={{
                      background: "linear-gradient(135deg, #E3C2D6, #91BFDF)",
                      color: "white",
                      fontWeight: "bold",
                      padding: "12px 32px",
                      borderRadius: "16px",
                      fontSize: "16px",
                      border: "none",
                      cursor: isNaming || !newName.trim() || !labubankAddress ? "not-allowed" : "pointer",
                      opacity: isNaming || !newName.trim() || !labubankAddress ? 0.5 : 1,
                      transition: "all 0.3s ease",
                      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseOver={(e) => {
                      if (!isNaming && newName.trim() && labubankAddress) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3)";
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.2)";
                    }}
                  >
                    {isNaming ? (
                      <>
                        <LoadingSpinner />
                        Naming...
                      </>
                    ) : (
                      "✨ Name My LabuBank"
                    )}
                  </button>
                </div>

                {!labubankAddress && (
                  <p
                    className="mobile-text"
                    style={{
                      fontSize: "0.9rem",
                      color: "rgba(255, 255, 255, 0.8)",
                      marginTop: "16px",
                      fontStyle: "italic",
                    }}
                  >
                    Please ensure you have a LabuBank NFT in your wallet
                  </p>
                )}
              </div>
            )}

            {/* Step 3: Coinbase Onramp */}
            {currentStep === 3 && (
              <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease-in-out" }}>
                <div
                  style={{
                    fontSize: "3rem",
                    marginBottom: "20px",
                    animation: "rotate 3s infinite linear",
                  }}
                >
                  💳🌟
                </div>
                <h2
                  style={{
                    fontSize: window.innerWidth < 768 ? "1.4rem" : "1.8rem",
                    fontWeight: "bold",
                    color: "white",
                    marginBottom: "16px",
                    textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                    lineHeight: "1.3",
                  }}
                >
                  You are now ready to free your funds!
                </h2>
                <p
                  className="mobile-text"
                  style={{
                    fontSize: "1.1rem",
                    color: "white",
                    marginBottom: "32px",
                    fontWeight: "500",
                    textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                    lineHeight: "1.4",
                  }}
                >
                  Welcome to the exciting onchain world!
                </p>

                {pyUSDTransferDetected && (
                  <div
                    style={{
                      backgroundColor: "rgba(76, 175, 80, 0.9)",
                      color: "white",
                      padding: "16px",
                      borderRadius: "12px",
                      marginBottom: "24px",
                      fontWeight: "bold",
                      fontSize: "1.1rem",
                      animation: "celebration 1s ease-in-out",
                    }}
                  >
                    🎉 pyUSD Transfer Detected! Welcome to DeFi! 🎉
                  </div>
                )}

                {isListeningForTransfer && (
                  <div
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: "white",
                      padding: "12px",
                      borderRadius: "8px",
                      marginBottom: "20px",
                      fontSize: "0.9rem",
                      animation: "pulse 2s infinite",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <LoadingSpinner />
                    Listening for your pyUSD transfer...
                  </div>
                )}

                <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    className="button-tap"
                    onClick={prevStep}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "16px",
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      color: "white",
                      border: "2px solid rgba(255, 255, 255, 0.3)",
                      cursor: "pointer",
                      fontSize: "16px",
                      fontWeight: "bold",
                      transition: "all 0.3s ease",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
                    }}
                  >
                    ← Back
                  </button>

                  <button
                    className="button-tap mobile-button"
                    onClick={handleBuyCrypto}
                    style={{
                      background: "linear-gradient(135deg, #E3C2D6, #91BFDF)",
                      color: "white",
                      fontWeight: "bold",
                      padding: "16px 32px",
                      borderRadius: "16px",
                      fontSize: "16px",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3)",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.4)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3)";
                    }}
                  >
                    💳 Buy USDC with Debit Card
                  </button>

                  <button
                    className="button-tap mobile-button"
                    onClick={completeOnboarding}
                    style={{
                      background: "linear-gradient(135deg, #4CAF50, #45a049)",
                      color: "white",
                      fontWeight: "bold",
                      padding: "16px 32px",
                      borderRadius: "16px",
                      fontSize: "16px",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3)",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.4)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3)";
                    }}
                  >
                    🎉 Complete Setup!
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header - only visible when onboarding is complete */}
      {!showOnboarding && (
        <header style={{ padding: "16px", textAlign: "center" }}>
          <div style={{ marginBottom: "16px" }}>
            <img
              src="/labuBankLogoCropped.jpg"
              alt="LabuBank Logo"
              style={{
                height: window.innerWidth < 768 ? "60px" : "80px",
                width: "auto",
                borderRadius: "12px",
                boxShadow: "0 4px 15px rgba(179, 128, 121, 0.2)",
              }}
            />
          </div>
          <p className="labu-header-secondary">Your friendly crypto companion</p>
        </header>
      )}

      {/* Portfolio Section - only visible when onboarding is complete */}
      {!showOnboarding && <PortfolioSection walletAddress={labubankAddress} />}

      {/* labubank Address Display - only visible when onboarding is complete */}
      {!showOnboarding && labubankAddress && (
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
              flexDirection: window.innerWidth < 768 ? "column" : "row",
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
                  fontSize: window.innerWidth < 768 ? "12px" : "16px",
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

      {/* Portfolio Loading Indicator - only visible when onboarding is complete */}
      {!showOnboarding && isPortfolioLoading && (
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
          <LoadingSpinner />
          Loading your portfolio data...
        </div>
      )}

      {/* 3D Model Container - only visible when onboarding is complete */}
      {!showOnboarding && (
        <div
          style={{
            height: window.innerWidth < 768 ? "300px" : "400px",
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
      )}

      {/* NFT Name Display - only visible when onboarding is complete */}
      {!showOnboarding && labubankAddress && (
        <div
          style={{
            margin: "0 16px 32px",
            textAlign: "center",
          }}
        >
          {isLoadingNftName ? (
            <div
              style={{
                background: "linear-gradient(135deg, #E3C2D6 0%, #91BFDF 50%, #E2B5BB 100%)",
                borderRadius: "20px",
                padding: "16px 24px",
                display: "inline-block",
                boxShadow: "0 8px 25px rgba(179, 128, 121, 0.2)",
                border: "2px solid rgba(255, 255, 255, 0.3)",
              }}
            >
              <span style={{ fontSize: "1.2rem", color: "white", fontWeight: "bold" }}>
                <LoadingSpinner />
                Loading your LabuBank's name...
              </span>
            </div>
          ) : nftName ? (
            <div
              style={{
                background: "linear-gradient(135deg, #91BFDF 0%, #E3C2D6 50%, #E2B5BB 100%)",
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
              
              <div style={{ fontSize: "1rem", color: "white", marginBottom: "4px", fontWeight: "600" }}>
                🎉 Meet Your LabuBank 🎉
              </div>
              
              <div
                style={{
                  fontSize: window.innerWidth < 768 ? "1.8rem" : "2.2rem",
                  fontWeight: "bold",
                  color: "white",
                  textShadow: "0 3px 6px rgba(0, 0, 0, 0.3)",
                  letterSpacing: "1px",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                "{nftName}"
              </div>
              
              <div style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.9)", marginTop: "4px" }}>
                🧸 Your personalized companion! 🧸
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "linear-gradient(135deg, #E2B5BB 0%, #E3C2D6 50%, #91BFDF 100%)",
                borderRadius: "20px",
                padding: "16px 24px",
                display: "inline-block",
                boxShadow: "0 8px 25px rgba(179, 128, 121, 0.2)",
                border: "2px solid rgba(255, 255, 255, 0.3)",
              }}
            >
              <span style={{ fontSize: "1.1rem", color: "white", fontWeight: "bold" }}>
                🏷️ Your LabuBank needs a name! Use the onboarding flow above 🏷️
              </span>
            </div>
          )}
        </div>
      )}

      {/* Chat Section - only visible when onboarding is complete */}
      {!showOnboarding && (
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
                    justifyContent: message.sender === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: message.sender === "user" ? "80%" : "90%",
                      padding: message.sender === "user" ? "10px 14px" : "16px 20px",
                      borderRadius: "18px",
                      backgroundColor: message.sender === "user" ? "#91BFDF" : "rgba(227, 194, 214, 0.8)",
                      color: message.sender === "user" ? "white" : "#B38079",
                      fontSize: window.innerWidth < 768 ? "13px" : "14px",
                      lineHeight: "1.6",
                      textAlign: "left",
                      overflowWrap: "break-word",
                      wordWrap: "break-word",
                      whiteSpace: "pre-wrap",
                      boxShadow: message.sender === "user" ? "0 2px 8px rgba(145, 191, 223, 0.3)" : "0 2px 8px rgba(227, 194, 214, 0.3)",
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
                    <LoadingSpinner />
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
                  fontSize: window.innerWidth < 768 ? "16px" : "14px",
                  outline: "none",
                  backgroundColor: "rgba(255, 255, 255, 0.8)",
                }}
              />
              <button
                className="button-tap"
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
                  transition: "all 0.3s ease",
                }}
              >
                {isLoading ? <LoadingSpinner /> : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Section - only visible when onboarding is complete */}
      {!showOnboarding && (
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
              Tap your labubank plushie to start your crypto journey. Your digital companion will guide you through the world of cryptocurrency.
            </p>

            <div style={{ width: "100%" }}>
              <button
                className="button-tap"
                onClick={handleBuyCrypto}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #91BFDF, #E3C2D6, #E2B5BB)",
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
                  transition: "all 0.3s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(179, 128, 121, 0.4)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 15px rgba(179, 128, 121, 0.3)";
                }}
              >
                💳 Buy USDC with Debit Card
              </button>
              <button
                className="button-tap"
                onClick={() => setShowOnboarding(true)}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #E3C2D6, #91BFDF, #E2B5BB)",
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
                  marginTop: "12px",
                  transition: "all 0.3s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(179, 128, 121, 0.4)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 15px rgba(179, 128, 121, 0.3)";
                }}
              >
                🚀 Restart Onboarding
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
                  💡 Click above to buy USDC on Ethereum with your debit card via Coinbase Pay
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;