import { createPublicClient, http, parseAbi, encodeFunctionData } from "viem";
import { mainnet } from "viem/chains";
import { PortfolioData, CachedPortfolio } from "../types";

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

const LABUBANK_NFT_CONTRACT = "0x26E427f68355d97d7FDEb999A07348194D298415";
const SIGNATURE_API_BASE = "http://192.168.107.116";

// Portfolio cache - in a real app, you might want to use localStorage or a more robust caching solution
const portfolioCache = new Map<string, CachedPortfolio>();
const CACHE_TTL = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

export const getCachedPortfolio = (
  walletAddress: string
): PortfolioData | null => {
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

export const setCachedPortfolio = (
  walletAddress: string,
  data: PortfolioData
) => {
  portfolioCache.set(walletAddress, {
    data,
    timestamp: Date.now(),
    ttl: CACHE_TTL,
  });
};

export const fetchPortfolioDataFromAPI = async (
  walletAddress: string
): Promise<PortfolioData | null> => {
  // Check cache first
  const cachedData = getCachedPortfolio(walletAddress);
  if (cachedData) {
    console.log("📋 Using cached portfolio data for wallet:", walletAddress);
    return cachedData;
  }

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

      // Cache the portfolio data
      setCachedPortfolio(walletAddress, data);

      return data;
    } else {
      console.error(
        "❌ Portfolio query failed:",
        response.status,
        response.statusText
      );
      const errorText = await response.text();
      console.error("Response body:", errorText);
      return null;
    }
  } catch (error) {
    console.error("❌ Portfolio query failed:", error);
    return null;
  }
};

export const getUserTokenId = async (
  userAddress: string
): Promise<bigint | null> => {
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
};

export const getUserNonce = async (userAddress: string): Promise<string> => {
  try {
    const nonce = await publicClient.getTransactionCount({
      address: userAddress as `0x${string}`,
    });
    return nonce.toString();
  } catch (error) {
    console.error("Error getting user nonce:", error);
    return "0";
  }
};

export const getSignatureFromAPI = async (txData: any): Promise<any> => {
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
};

export const generateSetNameCalldata = (
  tokenId: bigint,
  newName: string
): string => {
  return encodeFunctionData({
    abi: nftAbi,
    functionName: "setMyLabuBankName",
    args: [tokenId, newName],
  });
};

export const getNFTName = async (
  userAddress: string
): Promise<string | null> => {
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
};

export const refreshNftNameWithRetry = async (
  walletAddress: string,
  maxRetries: number,
  currentNftName: string | null,
  setNftName: (name: string | null) => void
) => {
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
};

export { publicClient, nftAbi, LABUBANK_NFT_CONTRACT };
