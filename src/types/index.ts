export interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

export interface PortfolioData {
  wallet_address: string;
  summary: string;
  portfolio_data: any;
}

export interface CachedPortfolio {
  data: PortfolioData;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}
