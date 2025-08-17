import React, { useState, useEffect } from "react";
import { getOnrampBuyUrl } from "@coinbase/onchainkit/fund";
import PortfolioSection from "./components/PortfolioSection";
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
      <Header
        nftName={nftName}
        isLoadingNftName={isLoadingNftName}
        labubankAddress={labubankAddress}
      />

      {/* Portfolio Section */}
      <PortfolioSection walletAddress={labubankAddress} />

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
    </div>
  );
}

export default App;
