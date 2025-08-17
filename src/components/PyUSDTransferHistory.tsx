import React, { useState, useEffect } from "react";

interface Transaction {
  amountIn: string;
  amountOut: string;
  collectionId: string;
  collectionName: string;
  created: string;
  depositAddress: string;
  id: string;
  timestamp: string;
  transactionHash: string;
  updated: string;
  userPublicAddress: string;
}

interface TransactionResponse {
  userPublicAddress: string;
  transactions: Transaction[];
  count: number;
  message: string;
}

interface PyUSDTransferHistoryProps {
  walletAddress: string | null;
}

export default function PyUSDTransferHistory({ walletAddress }: PyUSDTransferHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactionHistory = async (address: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://45.55.38.82/api/transactions?userPublicAddress=${address}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.status}`);
      }

      const data: TransactionResponse = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error("Error fetching transaction history:", error);
      setError("Failed to fetch transaction history");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatAmount = (amount: string, isPositive: boolean) => {
    const numAmount = parseFloat(amount);
    const formattedAmount = numAmount.toFixed(6);
    return isPositive ? `+${formattedAmount}` : `-${formattedAmount}`;
  };

  useEffect(() => {
    if (walletAddress) {
      fetchTransactionHistory(walletAddress);
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
          <span style={{ fontSize: "1.5rem" }}>📊</span>
          pyUSD Transfer History
        </h3>
      </div>

      <div
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          borderRadius: "12px",
          padding: "16px",
          backdropFilter: "blur(10px)",
        }}
      >
        {isLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              color: "white",
              fontSize: "16px",
            }}
          >
            <span style={{ marginRight: "8px", fontSize: "20px" }}>⏳</span>
            Loading transaction history...
          </div>
        ) : error ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              color: "#ffcccb",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        ) : transactions.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: "14px",
            }}
          >
            No transactions found
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                color: "white",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "12px 8px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "rgba(255, 255, 255, 0.8)",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    Time
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 8px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "rgba(255, 255, 255, 0.8)",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    USDC Amount
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "12px 8px",
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "rgba(255, 255, 255, 0.8)",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    pyUSD Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px 8px",
                        fontSize: "13px",
                        color: "white",
                      }}
                    >
                      {formatDateTime(transaction.timestamp)}
                    </td>
                    <td
                      style={{
                        padding: "12px 8px",
                        fontSize: "13px",
                        fontWeight: "600",
                        textAlign: "right",
                        color: "#ff6b6b", // Red for negative (outgoing)
                      }}
                    >
                      {formatAmount(transaction.amountIn, false)}
                    </td>
                    <td
                      style={{
                        padding: "12px 8px",
                        fontSize: "13px",
                        fontWeight: "600",
                        textAlign: "right",
                        color: "#51cf66", // Green for positive (incoming)
                      }}
                    >
                      {formatAmount(transaction.amountOut, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}