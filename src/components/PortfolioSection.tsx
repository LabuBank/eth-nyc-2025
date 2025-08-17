import React, { useState, useEffect } from "react";
import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(
    "https://nd-489-221-744.p2pify.com/6179c84d7869593699be73681b4a96d9"
  ),
});

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

const PYUSD_CONTRACT = "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8";

interface PortfolioSectionProps {
  walletAddress: string | null;
}

interface TokenBalance {
  balance: string;
  symbol: string;
  isLoading: boolean;
  error: string | null;
}

export default function PortfolioSection({
  walletAddress,
}: PortfolioSectionProps) {
  const [tokenBalance, setTokenBalance] = useState<TokenBalance>({
    balance: "0",
    symbol: "pyUSD",
    isLoading: false,
    error: null,
  });

  const fetchTokenBalance = async (address: string) => {
    setTokenBalance((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const [balance, decimals, symbol] = await Promise.all([
        publicClient.readContract({
          address: PYUSD_CONTRACT,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }),
        publicClient.readContract({
          address: PYUSD_CONTRACT,
          abi: erc20Abi,
          functionName: "decimals",
        }),
        publicClient.readContract({
          address: PYUSD_CONTRACT,
          abi: erc20Abi,
          functionName: "symbol",
        }),
      ]);

      const formattedBalance = (
        Number(balance) / Math.pow(10, decimals)
      ).toFixed(2);

      setTokenBalance({
        balance: formattedBalance,
        symbol: symbol,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching token balance:", error);
      setTokenBalance((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to fetch balance",
      }));
    }
  };

  useEffect(() => {
    if (walletAddress) {
      fetchTokenBalance(walletAddress);
    }
  }, [walletAddress]);

  if (!walletAddress) {
    return null;
  }

  return (
    <div
      style={{
        margin: "0 16px 16px",
        backgroundColor: "rgba(227, 194, 214, 0.9)",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 8px 25px rgba(179, 128, 121, 0.15)",
        border: "2px solid rgba(145, 191, 223, 0.3)",
      }}
    >
      {/* Portfolio Balance Section */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <h3
          style={{
            fontSize: "1.3rem",
            fontWeight: "bold",
            color: "white",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>💰</span>
          Portfolio Balance
        </h3>
      </div>

      <div
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          borderRadius: "12px",
          padding: "16px",
          backdropFilter: "blur(10px)",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "4px",
              }}
            >
              <img
                src="/pyusd_logo.png"
                alt="pyUSD Logo"
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
              <p
                style={{
                  fontSize: "14px",
                  color: "rgba(255, 255, 255, 0.8)",
                  margin: 0,
                  fontWeight: "500",
                }}
              >
                {tokenBalance.symbol}
              </p>
            </div>
            <p
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: "white",
                margin: 0,
              }}
            >
              {tokenBalance.isLoading ? (
                <span
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span style={{ fontSize: "16px" }}>⏳</span>
                  Loading...
                </span>
              ) : tokenBalance.error ? (
                <span style={{ fontSize: "14px", color: "#ffcccb" }}>
                  {tokenBalance.error}
                </span>
              ) : (
                `${tokenBalance.balance}`
              )}
            </p>
          </div>
          <div
            style={{
              backgroundColor: "rgba(145, 191, 223, 0.3)",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "12px",
              color: "white",
              fontFamily: "monospace",
              wordBreak: "break-all",
              maxWidth: "120px",
            }}
          >
            {PYUSD_CONTRACT.substring(0, 6)}...{PYUSD_CONTRACT.substring(38)}
          </div>
        </div>
      </div>

      {/* LabuBank's Ethereum Address Section */}
      <div
        style={{
          backgroundColor: "rgba(145, 191, 223, 0.9)",
          borderRadius: "12px",
          padding: "16px",
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
              Your LabuBank's Address
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
              {walletAddress}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
