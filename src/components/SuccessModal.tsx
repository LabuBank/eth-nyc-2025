import React from "react";

interface SuccessModalProps {
  isOpen: boolean;
  transactionHash: string;
  onClose: () => void;
}

export default function SuccessModal({
  isOpen,
  transactionHash,
  onClose,
}: SuccessModalProps) {
  if (!isOpen) return null;

  return (
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
            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          🔗 View Your Transaction
        </a>

        {/* Have Fun Button */}
        <div>
          <button
            onClick={onClose}
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
              e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.4)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3)";
            }}
          >
            🎈 Have fun!
          </button>
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
    </div>
  );
}
