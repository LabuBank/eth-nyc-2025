import React, { Suspense, useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { getOnrampBuyUrl } from "@coinbase/onchainkit/fund";
import { createPublicClient, http, encodeFunctionData, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import PortfolioSection from "./components/PortfolioSection";
import PyUSDTransferHistory from "./components/PyUSDTransferHistory";
import Header from "./components/Header";
import Model3D from "./components/Model3D";
import ChatInterface from "./components/ChatInterface";
import WelcomeSection from "./components/WelcomeSection";
import NameModal from "./components/NameModal";
import SuccessModal from "./components/SuccessModal";
import { Message, PortfolioData } from "./types";
import {
  fetchPortfolioDataFromAPI,
  getNFTName,
  getUserTokenId,
  getUserNonce,
  getSignatureFromAPI,
  generateSetNameCalldata,
  refreshNftNameWithRetry,
  publicClient,
} from "./utils/portfolioUtils";

function LabubankModel() {
  const { scene } = useGLTF("/labubank.glb");
  return <primitive object={scene} scale={3} />;
}

function LoadingSpinner() {
  return (
    <div
      style={{
        width: "16px",
        height: "16px",
        border: "2px solid rgba(255, 255, 255, 0.3)",
        borderTop: "2px solid white",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
        marginRight: "8px",
      }}
    />
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "6px",
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        borderRadius: "3px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: "100%",
          background: "linear-gradient(90deg, #91BFDF, #E3C2D6)",
          borderRadius: "3px",
          transition: "width 0.5s ease-in-out",
        }}
      />
    </div>
  );
}

const LABUBANK_NFT_CONTRACT = "0x26E427f68355d97d7FDEb999A07348194D298415";
const PYUSD_CONTRACT = "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8";
const SIGNATURE_API_BASE = "http://192.168.107.116";

const nftAbi = parseAbi([
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function setMyLabuBankName(uint256 _tokenId, string memory _newName) external",
  "function balanceOf(address owner) view returns (uint256)",
  "function myLabuBankName(uint256 tokenId) view returns (string)",
]);

function App() {
  // State for DM/ui-simplification components
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [labubuAddress, setLabubuAddress] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [isNaming, setIsNaming] = useState(false);
  const [labubankAddress, setlabubankAddress] = useState<string | null>(null);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [isPortfolioLoading, setIsPortfolioLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState<string>("");
  const [nftName, setNftName] = useState<string | null>(null);
  const [isLoadingNftName, setIsLoadingNftName] = useState(false);

  // State for jun/ui-changes onboarding flow
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [isNamingComplete, setIsNamingComplete] = useState(false);
  const [isOnrampComplete, setIsOnrampComplete] = useState(false);
  const [completedNftName, setCompletedNftName] = useState<string>("");
  const [pyUSDTransferDetected, setPyUSDTransferDetected] = useState(false);
  const [isListeningForTransfer, setIsListeningForTransfer] = useState(false);

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
    // Extract Ethereum address from URL path
    const path = window.location.pathname;
    const addressMatch = path.match(/\/(0x[a-fA-F0-9]{40})/);

    if (addressMatch) {
      const address = addressMatch[1];
      setlabubankAddress(address);
      // Fetch portfolio data when address is available
      fetchPortfolioDataFromAPI(address);
      // Fetch NFT name when address is available
      fetchNftName(address);
    }
  }, []);

  const handlePortfolioData = async (walletAddress: string) => {
    setIsPortfolioLoading(true);
    try {
      const data = await fetchPortfolioDataFromAPI(walletAddress);

      if (data) {
        setPortfolioData(data);

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
      console.error("Error fetching portfolio data:", error);
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

  // Onboarding flow functions
  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNameLabubank = async () => {
    if (!newName.trim() || !labubankAddress) return;

    setIsNaming(true);
    try {
      const tokenId = await getUserTokenId(labubankAddress);
      if (!tokenId) {
        alert("No Labubank NFT found for this address");
        return;
      }

      const calldata = generateSetNameCalldata(tokenId, newName);
      const nonce = await getUserNonce(labubankAddress!);

      const txData = {
        to: "0x26E427f68355d97d7FDEb999A07348194D298415",
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

  const continueFromNaming = () => {
    setCompletedNftName(newName);
    setIsNamingComplete(false);
    nextStep();
  };

  const completeOnboarding = () => {
    setShowOnboarding(false);
    // Initialize portfolio data and messages for main page
    if (labubankAddress) {
      handlePortfolioData(labubankAddress);
    }
  };

  const handleBuyCrypto = async () => {
    try {
      const projectId = process.env.REACT_APP_CDP_PROJECT_ID;
      console.log("projectId is", projectId);
      // Fallback to hardcoded address for testing
      const userPublicAddress = labubankAddress || "0x94544835Cf97c631f101c5f538787fE14E2E04f6";

      // Get the deposit address for this user
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

      // Generate session token dynamically using the new endpoint
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
      
      // Start listening for transfers in onboarding
      if (showOnboarding) {
        setIsListeningForTransfer(true);
        // Simulate transfer detection for demo purposes
        setTimeout(() => {
          setPyUSDTransferDetected(true);
          setIsListeningForTransfer(false);
        }, 5000);
      }
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

        // Log additional info for debugging
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
    } finally {
      setIsLoading(false);
    }
  };

  const onboardingProgress = ((currentStep - 1) / 2) * 100;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #91BFDF, #E3D3E4, #E3C2D6, #E2B5BB)",
        color: "#B38079",
        paddingBottom: showOnboarding ? "0" : "120px", // Add padding for fixed chat bar only on main page
      }}
    >
      {/* Onboarding Modal */}
      {showOnboarding && (
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
            backdropFilter: "blur(5px)",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #91BFDF 0%, #E3C2D6 50%, #E2B5BB 100%)",
              borderRadius: "24px",
              padding: "32px",
              maxWidth: "400px",
              width: "100%",
              height: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)",
              position: "relative",
              animation: "slideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {/* Step Progress */}
            <div style={{ textAlign: "center", marginBottom: "16px", flexShrink: 0 }}>
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

            {/* 3D Model Container */}
            <div
              style={{
                height: "160px",
                marginBottom: "16px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: "16px",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                flexShrink: 0,
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

            {/* Step Content Container */}
            <div style={{ flex: 1, overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              {/* Step 1: Welcome */}
              {currentStep === 1 && (
              <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease-in-out", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
                {/* Floating celebration emojis */}
                <div style={{ 
                  position: "absolute", 
                  top: "10px", 
                  left: "10%",
                  fontSize: "1.5rem",
                  animation: "float 3s infinite, sparkle 2s infinite"
                }}>🎉</div>
                <div style={{ 
                  position: "absolute", 
                  top: "20px", 
                  right: "15%",
                  fontSize: "1.2rem",
                  animation: "wiggle 2.5s infinite, rainbow 4s infinite"
                }}>⭐</div>
                <div style={{ 
                  position: "absolute", 
                  bottom: "120px", 
                  left: "8%",
                  fontSize: "1.3rem",
                  animation: "superBounce 2.2s infinite, partyTime 3s infinite"
                }}>💫</div>
                <div style={{ 
                  position: "absolute", 
                  bottom: "140px", 
                  right: "12%",
                  fontSize: "1.4rem",
                  animation: "float 2.8s infinite, sparkle 1.8s infinite"
                }}>🌟</div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div
                    style={{
                      fontSize: "3rem",
                      marginBottom: "24px",
                      display: "flex",
                      justifyContent: "center",
                      gap: "12px",
                    }}
                  >
                    <span style={{ animation: "superBounce 2s infinite, rainbow 4s infinite" }}>🧸</span>
                    <span style={{ animation: "sparkle 1.5s infinite, wiggle 2.5s infinite" }}>✨</span>
                    <span style={{ animation: "partyTime 2.2s infinite, float 3s infinite" }}>🎈</span>
                  </div>
                  <h2
                    style={{
                      fontSize: window.innerWidth < 768 ? "1.8rem" : "2.2rem",
                      fontWeight: "bold",
                      color: "white",
                      marginBottom: "20px",
                      textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                      lineHeight: "1.3",
                    }}
                  >
                    Meet Your LabuBank!
                  </h2>
                  <p
                    className="mobile-text"
                    style={{
                      fontSize: "1.3rem",
                      color: "white",
                      marginBottom: "40px",
                      fontWeight: "500",
                      textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                      lineHeight: "1.5",
                    }}
                  >
                    Your Friendly Crypto Companion!
                  </p>
                </div>

                <div style={{ paddingBottom: "20px" }}>
                  <button
                    className="button-tap mobile-button"
                    onClick={nextStep}
                    style={{
                      background: "linear-gradient(135deg, #E3C2D6, #91BFDF)",
                      color: "white",
                      fontWeight: "bold",
                      padding: "18px 36px",
                      borderRadius: "25px",
                      fontSize: "1.2rem",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 8px 25px rgba(0, 0, 0, 0.3)",
                      transition: "all 0.3s ease",
                      minWidth: "220px",
                      animation: "pulse 3s infinite",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px) scale(1.05)";
                      e.currentTarget.style.boxShadow = "0 12px 30px rgba(0, 0, 0, 0.4)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0) scale(1)";
                      e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.3)";
                    }}
                  >
                    🚀 Let's Get Started!
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Name Your LabuBank */}
            {currentStep === 2 && !isNamingComplete && (
              <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease-in-out", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
                {/* Floating creative emojis */}
                <div style={{ 
                  position: "absolute", 
                  top: "15px", 
                  left: "12%",
                  fontSize: "1.4rem",
                  animation: "wiggle 2.8s infinite, rainbow 3.5s infinite"
                }}>🎨</div>
                <div style={{ 
                  position: "absolute", 
                  top: "25px", 
                  right: "18%",
                  fontSize: "1.2rem",
                  animation: "sparkle 2.2s infinite, float 3.2s infinite"
                }}>✏️</div>
                <div style={{ 
                  position: "absolute", 
                  bottom: "100px", 
                  left: "15%",
                  fontSize: "1.3rem",
                  animation: "superBounce 2.5s infinite, partyTime 4s infinite"
                }}>💖</div>
                <div style={{ 
                  position: "absolute", 
                  bottom: "120px", 
                  right: "10%",
                  fontSize: "1.1rem",
                  animation: "float 3s infinite, wiggle 2s infinite"
                }}>🌈</div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div
                    style={{
                      fontSize: "2.5rem",
                      marginBottom: "16px",
                      display: "flex",
                      justifyContent: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ animation: "wiggle 2s infinite, rainbow 3s infinite" }}>🏷️</span>
                    <span style={{ animation: "sparkle 1.8s infinite, superBounce 2.5s infinite" }}>✨</span>
                    <span style={{ animation: "partyTime 2.3s infinite, float 3.5s infinite" }}>📝</span>
                  </div>
                  <h2
                    style={{
                      fontSize: window.innerWidth < 768 ? "1.5rem" : "1.8rem",
                      fontWeight: "bold",
                      color: "white",
                      marginBottom: "24px",
                      textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                      lineHeight: "1.2",
                    }}
                  >
                    Give your LabuBank a nickname!
                  </h2>

                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter a nickname..."
                    style={{
                      width: "100%",
                      padding: "16px 20px",
                      borderRadius: "18px",
                      border: "3px solid rgba(255, 255, 255, 0.4)",
                      fontSize: "17px",
                      outline: "none",
                      marginBottom: "24px",
                      boxSizing: "border-box",
                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                      textAlign: "center",
                      fontWeight: "500",
                      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
                    }}
                    maxLength={20}
                  />

                  {/* Main action button */}
                  <div style={{ marginBottom: "16px" }}>
                    <button
                      className="button-tap mobile-button"
                      onClick={() => {
                        if (newName.trim()) {
                          setCompletedNftName(newName.trim());
                          setIsNamingComplete(true);
                        }
                      }}
                      disabled={!newName.trim()}
                      style={{
                        background: "linear-gradient(135deg, #E3C2D6, #91BFDF)",
                        color: "white",
                        fontWeight: "bold",
                        padding: "14px 32px",
                        borderRadius: "18px",
                        fontSize: "1rem",
                        border: "none",
                        cursor: !newName.trim() ? "not-allowed" : "pointer",
                        opacity: !newName.trim() ? 0.5 : 1,
                        transition: "all 0.3s ease",
                        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.2)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: "180px",
                        animation: newName.trim() ? "pulse 2s infinite" : "none",
                      }}
                      onMouseOver={(e) => {
                        if (newName.trim()) {
                          e.currentTarget.style.transform = "translateY(-3px) scale(1.05)";
                          e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.3)";
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "translateY(0) scale(1)";
                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.2)";
                      }}
                    >
                      ✨ Name My LabuBank
                    </button>
                  </div>
                </div>

                <div style={{ paddingBottom: "16px" }}>
                  {/* Back button */}
                  <div style={{ marginBottom: "10px" }}>
                    <button
                      className="button-tap"
                      onClick={prevStep}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "15px",
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        color: "white",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "normal",
                        transition: "all 0.3s ease",
                        marginRight: "12px",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      ← Back
                    </button>

                    {/* Skip option */}
                    <button
                      className="button-tap"
                      onClick={nextStep}
                      style={{
                        background: "transparent",
                        color: "rgba(255, 255, 255, 0.6)",
                        fontWeight: "normal",
                        padding: "10px 20px",
                        borderRadius: "15px",
                        fontSize: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      skip
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Naming Completion State */}
            {currentStep === 2 && isNamingComplete && (
              <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease-in-out", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
                {/* Floating celebration emojis */}
                <div style={{ 
                  position: "absolute", 
                  top: "20px", 
                  left: "15%",
                  fontSize: "1.3rem",
                  animation: "partyTime 2s infinite, sparkle 1.5s infinite"
                }}>🎉</div>
                <div style={{ 
                  position: "absolute", 
                  top: "30px", 
                  right: "20%",
                  fontSize: "1.4rem",
                  animation: "superBounce 2.2s infinite, rainbow 3s infinite"
                }}>🌟</div>
                <div style={{ 
                  position: "absolute", 
                  bottom: "80px", 
                  left: "10%",
                  fontSize: "1.2rem",
                  animation: "float 2.8s infinite, wiggle 2.5s infinite"
                }}>🎊</div>
                <div style={{ 
                  position: "absolute", 
                  bottom: "100px", 
                  right: "15%",
                  fontSize: "1.5rem",
                  animation: "sparkle 1.8s infinite, partyTime 3.2s infinite"
                }}>💫</div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div
                    style={{
                      fontSize: "3rem",
                      marginBottom: "24px",
                      display: "flex",
                      justifyContent: "center",
                      gap: "12px",
                    }}
                  >
                    <span style={{ animation: "superBounce 1.8s infinite, rainbow 3s infinite" }}>🧸</span>
                    <span style={{ animation: "partyTime 1.5s infinite, sparkle 2s infinite" }}>🎉</span>
                    <span style={{ animation: "float 2.5s infinite, wiggle 2s infinite" }}>✨</span>
                  </div>
                  <h2
                    style={{
                      fontSize: window.innerWidth < 768 ? "1.5rem" : "1.9rem",
                      fontWeight: "bold",
                      color: "white",
                      marginBottom: "20px",
                      textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                      lineHeight: "1.2",
                    }}
                  >
                    You named "{completedNftName}" successfully!
                  </h2>
                  <p
                    className="mobile-text"
                    style={{
                      fontSize: "1.1rem",
                      color: "white",
                      marginBottom: "40px",
                      fontWeight: "500",
                      textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                      lineHeight: "1.4",
                    }}
                  >
                    Ready for the next step!
                  </p>
                </div>

                <div style={{ paddingBottom: "20px" }}>
                  <button
                    className="button-tap mobile-button"
                    onClick={continueFromNaming}
                    style={{
                      background: "linear-gradient(135deg, #91BFDF, #E3C2D6, #E2B5BB)",
                      color: "white",
                      fontWeight: "bold",
                      padding: "18px 36px",
                      borderRadius: "25px",
                      fontSize: "1.2rem",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 8px 25px rgba(0, 0, 0, 0.3)",
                      transition: "all 0.3s ease",
                      minWidth: "220px",
                      animation: "pulse 3s infinite",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px) scale(1.05)";
                      e.currentTarget.style.boxShadow = "0 12px 30px rgba(0, 0, 0, 0.4)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0) scale(1)";
                      e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.3)";
                    }}
                  >
                    🚀 Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Coinbase Onramp */}
            {currentStep === 3 && !isOnrampComplete && (
              <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease-in-out", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
                {/* Floating money emojis */}
                <div style={{ 
                  position: "absolute", 
                  top: "10px", 
                  left: "12%",
                  fontSize: "1.4rem",
                  animation: "rotate 3s infinite linear, rainbow 4s infinite"
                }}>💰</div>
                <div style={{ 
                  position: "absolute", 
                  top: "25px", 
                  right: "18%",
                  fontSize: "1.3rem",
                  animation: "sparkle 2s infinite, float 3s infinite"
                }}>💎</div>
                <div style={{ 
                  position: "absolute", 
                  bottom: "100px", 
                  left: "15%",
                  fontSize: "1.2rem",
                  animation: "superBounce 2.5s infinite, partyTime 3.5s infinite"
                }}>🚀</div>
                <div style={{ 
                  position: "absolute", 
                  bottom: "120px", 
                  right: "10%",
                  fontSize: "1.5rem",
                  animation: "wiggle 2.8s infinite, sparkle 2.2s infinite"
                }}>🌟</div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div
                    style={{
                      fontSize: "2.8rem",
                      marginBottom: "20px",
                      display: "flex",
                      justifyContent: "center",
                      gap: "12px",
                    }}
                  >
                    <span style={{ animation: "rotate 3s infinite linear, rainbow 4s infinite" }}>💳</span>
                    <span style={{ animation: "sparkle 1.5s infinite, superBounce 2.5s infinite" }}>🌟</span>
                    <span style={{ animation: "partyTime 2.2s infinite, float 3s infinite" }}>💰</span>
                  </div>
                  <h2
                    style={{
                      fontSize: window.innerWidth < 768 ? "1.5rem" : "1.8rem",
                      fontWeight: "bold",
                      color: "white",
                      marginBottom: "20px",
                      textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                      lineHeight: "1.2",
                    }}
                  >
                    Ready to free your funds!
                  </h2>
                  <p
                    className="mobile-text"
                    style={{
                      fontSize: "1.1rem",
                      color: "white",
                      marginBottom: "32px",
                      fontWeight: "500",
                      textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                      lineHeight: "1.3",
                    }}
                  >
                    Welcome to the exciting onchain world!
                  </p>

                  {pyUSDTransferDetected && (
                    <div
                      style={{
                        background: "linear-gradient(135deg, #91BFDF, #E3C2D6, #E2B5BB)",
                        color: "white",
                        padding: "14px",
                        borderRadius: "12px",
                        marginBottom: "20px",
                        fontWeight: "bold",
                        fontSize: "1rem",
                        animation: "celebration 1s ease-in-out",
                        boxShadow: "0 8px 25px rgba(179, 128, 121, 0.3)",
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
                        padding: "10px",
                        borderRadius: "8px",
                        marginBottom: "16px",
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

                  {/* Main action button */}
                  <div style={{ marginBottom: "20px" }}>
                    <button
                      className="button-tap mobile-button"
                      onClick={handleBuyCrypto}
                      style={{
                        background: "linear-gradient(135deg, #E3C2D6, #91BFDF)",
                        color: "white",
                        fontWeight: "bold",
                        padding: "16px 36px",
                        borderRadius: "20px",
                        fontSize: "1.1rem",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3)",
                        minWidth: "200px",
                        animation: "pulse 2.5s infinite",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "translateY(-3px) scale(1.05)";
                        e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.4)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "translateY(0) scale(1)";
                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3)";
                      }}
                    >
                      💳 Buy USDC with Debit Card
                    </button>
                  </div>
                </div>

                <div style={{ paddingBottom: "16px" }}>
                  {/* Back button */}
                  <div style={{ marginBottom: "10px" }}>
                    <button
                      className="button-tap"
                      onClick={prevStep}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "15px",
                        backgroundColor: "rgba(255, 255, 255, 0.2)",
                        color: "white",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "normal",
                        transition: "all 0.3s ease",
                        marginRight: "12px",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      ← Back
                    </button>

                    {/* Skip option */}
                    <button
                      className="button-tap"
                      onClick={() => setIsOnrampComplete(true)}
                      style={{
                        background: "transparent",
                        color: "rgba(255, 255, 255, 0.6)",
                        fontWeight: "normal",
                        padding: "10px 20px",
                        borderRadius: "15px",
                        fontSize: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      skip
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Onramp Completion Final Celebration */}
            {currentStep === 3 && isOnrampComplete && (
              <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease-in-out", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
                {/* Ultra festive floating emojis */}
                <div style={{ 
                  position: "absolute", 
                  top: "5px", 
                  left: "8%",
                  fontSize: "1.8rem",
                  animation: "partyTime 1.5s infinite, sparkle 2s infinite"
                }}>🎊</div>
                <div style={{ 
                  position: "absolute", 
                  top: "15px", 
                  right: "12%",
                  fontSize: "1.6rem",
                  animation: "superBounce 2s infinite, rainbow 3s infinite"
                }}>🎉</div>
                <div style={{ 
                  position: "absolute", 
                  top: "35px", 
                  left: "20%",
                  fontSize: "1.4rem",
                  animation: "float 2.5s infinite, wiggle 3s infinite"
                }}>🌟</div>
                <div style={{ 
                  position: "absolute", 
                  top: "40px", 
                  right: "25%",
                  fontSize: "1.3rem",
                  animation: "sparkle 1.8s infinite, partyTime 2.8s infinite"
                }}>💫</div>
                <div style={{ 
                  position: "absolute", 
                  bottom: "60px", 
                  left: "5%",
                  fontSize: "1.5rem",
                  animation: "superBounce 2.2s infinite, rainbow 4s infinite"
                }}>🚀</div>
                <div style={{ 
                  position: "absolute", 
                  bottom: "80px", 
                  right: "8%",
                  fontSize: "1.4rem",
                  animation: "float 3s infinite, sparkle 2.5s infinite"
                }}>🎆</div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div
                    style={{
                      fontSize: "3.5rem",
                      marginBottom: "24px",
                      display: "flex",
                      justifyContent: "center",
                      gap: "15px",
                    }}
                  >
                    <span style={{ animation: "superBounce 1.5s infinite, rainbow 3s infinite" }}>🧸</span>
                    <span style={{ animation: "partyTime 1.8s infinite, sparkle 2s infinite" }}>🎉</span>
                    <span style={{ animation: "float 2.2s infinite, wiggle 2.8s infinite" }}>✨</span>
                    <span style={{ animation: "superBounce 2s infinite, rainbow 4s infinite" }}>🎊</span>
                  </div>
                  <h2
                    style={{
                      fontSize: window.innerWidth < 768 ? "1.7rem" : "2.3rem",
                      fontWeight: "bold",
                      color: "white",
                      marginBottom: "20px",
                      textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                      lineHeight: "1.2",
                    }}
                  >
                    You are now all set up!
                  </h2>
                  <p
                    className="mobile-text"
                    style={{
                      fontSize: "1.2rem",
                      color: "white",
                      marginBottom: "16px",
                      fontWeight: "500",
                      textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                      lineHeight: "1.4",
                    }}
                  >
                    Welcome to the world of on-chain finance.
                  </p>
                  <p
                    className="mobile-text"
                    style={{
                      fontSize: "1.1rem",
                      color: "white",
                      marginBottom: "32px",
                      fontWeight: "500",
                      textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                      lineHeight: "1.3",
                    }}
                  >
                    {completedNftName || nftName || "Your LabuBank"} is now your crypto companion! 🧸💫
                  </p>
                </div>

                <div style={{ paddingBottom: "20px" }}>
                  <button
                    className="button-tap mobile-button"
                    onClick={completeOnboarding}
                    style={{
                      background: "linear-gradient(135deg, #91BFDF, #E3C2D6, #E2B5BB)",
                      color: "white",
                      fontWeight: "bold",
                      padding: "20px 40px",
                      borderRadius: "25px",
                      fontSize: "1.3rem",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 10px 35px rgba(0, 0, 0, 0.3)",
                      transition: "all 0.3s ease",
                      minWidth: "260px",
                      animation: "pulse 3s infinite",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-6px) scale(1.08)";
                      e.currentTarget.style.boxShadow = "0 15px 40px rgba(0, 0, 0, 0.4)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0) scale(1)";
                      e.currentTarget.style.boxShadow = "0 10px 35px rgba(0, 0, 0, 0.3)";
                    }}
                  >
                    🎉 Enter Your Crypto Journey!
                  </button>

                  {/* Back button */}
                  <div style={{ textAlign: "center", marginTop: "16px" }}>
                    <button
                      className="button-tap"
                      onClick={() => setIsOnrampComplete(false)}
                      style={{
                        background: "transparent",
                        color: "rgba(255, 255, 255, 0.6)",
                        fontWeight: "normal",
                        padding: "10px 20px",
                        borderRadius: "15px",
                        fontSize: "14px",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      ← back
                    </button>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Main Page - DM/ui-simplification layout */}
      {!showOnboarding && (
        <>
          {/* Header */}
          <Header
            nftName={nftName}
            isLoadingNftName={isLoadingNftName}
            labubankAddress={labubankAddress}
          />

          {/* Portfolio Section */}
          <PortfolioSection walletAddress={labubankAddress} />

          {/* pyUSD Transfer History */}
          <PyUSDTransferHistory walletAddress={labubankAddress} />

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

          {/* 3D Model */}
          <Model3D />

          {/* Chat Interface */}
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            inputMessage={inputMessage}
            onInputChange={setInputMessage}
            onSendMessage={sendMessage}
          />

          {/* Welcome Section */}
          <WelcomeSection
            onBuyCrypto={handleBuyCrypto}
            onShowNameModal={() => setShowNameModal(true)}
            labubankAddress={labubankAddress}
          />

          {/* Name Modal */}
          <NameModal
            isOpen={showNameModal}
            newName={newName}
            isNaming={isNaming}
            onNameChange={setNewName}
            onConfirm={handleNameLabubank}
            onCancel={() => {
              setShowNameModal(false);
              setNewName("");
            }}
          />

          {/* Success Modal */}
          <SuccessModal
            isOpen={showSuccessModal}
            transactionHash={transactionHash}
            onClose={() => {
              setShowSuccessModal(false);
              setTransactionHash("");
              // Also refresh the NFT name when closing success modal
              if (labubankAddress) {
                fetchNftName(labubankAddress);
              }
            }}
          />
        </>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes slideIn {
            0% {
              opacity: 0;
              transform: translateY(50px) scale(0.9);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }

          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
          }

          @keyframes superBounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-8px); }
            60% { transform: translateY(-4px); }
          }

          @keyframes sparkle {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
          }

          @keyframes wiggle {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(-3deg); }
            75% { transform: rotate(3deg); }
          }

          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
          }

          @keyframes partyTime {
            0%, 100% { transform: scale(1) rotate(0deg); }
            25% { transform: scale(1.1) rotate(-5deg); }
            75% { transform: scale(1.1) rotate(5deg); }
          }

          @keyframes rainbow {
            0% { filter: hue-rotate(0deg); }
            100% { filter: hue-rotate(360deg); }
          }

          @keyframes rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes celebration {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }

          .button-tap {
            transform-origin: center;
            transition: transform 0.1s ease;
          }

          .button-tap:active {
            transform: scale(0.95);
          }

          .mobile-text {
            font-size: 1rem;
          }

          .mobile-button {
            font-size: 1rem;
            padding: 12px 24px;
          }

          @media (max-width: 768px) {
            .mobile-text {
              font-size: 0.9rem;
            }
            .mobile-button {
              font-size: 0.9rem;
              padding: 10px 20px;
            }
          }
        `}
      </style>
    </div>
  );
}

export default App;