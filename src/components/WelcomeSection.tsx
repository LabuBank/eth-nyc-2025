import React from "react";

interface WelcomeSectionProps {
  onBuyCrypto: () => void;
  onShowNameModal: () => void;
  labubankAddress: string | null;
}

export default function WelcomeSection({
  onBuyCrypto,
  onShowNameModal,
  labubankAddress,
}: WelcomeSectionProps) {
  return (
    <div style={{ padding: "0 24px 32px" }}>
      <div
        style={{
          position: "relative",
          background:
            "linear-gradient(135deg, rgba(227, 211, 228, 0.95), rgba(145, 191, 223, 0.9))",
          borderRadius: "24px",
          padding: "32px 24px",
          boxShadow: "0 15px 40px rgba(179, 128, 121, 0.2)",
          border: "2px solid rgba(227, 194, 214, 0.4)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h2
            style={{
              fontSize: "2rem",
              fontWeight: "700",
              color: "white",
              margin: "0 0 16px 0",
              textShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
              fontFamily:
                "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            Welcome to Crypto!
          </h2>
          <p
            style={{
              fontSize: "1.15rem",
              color: "rgba(255, 255, 255, 0.9)",
              margin: 0,
              lineHeight: "1.7",
              maxWidth: "600px",
              marginLeft: "auto",
              marginRight: "auto",
              fontFamily:
                "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            Your LabuBank companion is here to guide you through the exciting
            world of cryptocurrency. Start your journey with confidence.
          </p>
        </div>

        <div style={{ width: "100%", position: "relative", zIndex: 1 }}>
          <button
            onClick={onBuyCrypto}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #91BFDF, #E3C2D6, #E2B5BB)",
              color: "white",
              fontWeight: "bold",
              padding: "18px 24px",
              borderRadius: "16px",
              fontSize: "1.2rem",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              boxShadow: "0 8px 25px rgba(179, 128, 121, 0.3)",
              marginBottom: "16px",
            }}
          >
            <span>→</span>
            Buy USDC with Debit Card
            <span>→</span>
          </button>

          <button
            onClick={onShowNameModal}
            disabled={!labubankAddress}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #E3C2D6, #91BFDF, #E2B5BB)",
              color: "white",
              fontWeight: "bold",
              padding: "18px 24px",
              borderRadius: "16px",
              fontSize: "1.2rem",
              border: "none",
              cursor: labubankAddress ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              boxShadow: "0 8px 25px rgba(179, 128, 121, 0.3)",
              opacity: labubankAddress ? 1 : 0.5,
            }}
          >
            <span>✦</span>
            Name my Labubank
            <span>✦</span>
          </button>
        </div>
      </div>
    </div>
  );
}
