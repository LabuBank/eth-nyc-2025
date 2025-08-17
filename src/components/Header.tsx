import React from "react";

interface HeaderProps {
  nftName: string | null;
  isLoadingNftName: boolean;
  labubankAddress: string | null;
}

export default function Header({
  nftName,
  isLoadingNftName,
  labubankAddress,
}: HeaderProps) {
  return (
    <>
      {/* Header */}
      <header style={{ padding: "16px", textAlign: "center" }}>
        <div style={{ marginBottom: "16px" }}>
          <img
            src="/labubank_transparent.png"
            alt="LabuBank Logo"
            style={{
              height: "80px",
              width: "auto",
              borderRadius: "12px",
              boxShadow: "0 4px 15px rgba(179, 128, 121, 0.2)",
            }}
          />
        </div>
        <div
          style={{
            background: "linear-gradient(135deg, #91BFDF, #E3C2D6, #E2B5BB)",
            padding: "2px",
            borderRadius: "20px",
            margin: "8px 0 0 0",
            display: "inline-block",
            animation: "gradientShift 3s ease-in-out infinite",
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              borderRadius: "18px",
              padding: "10px 20px",
              textAlign: "center",
              backdropFilter: "blur(10px)",
            }}
          >
            <p
              style={{
                fontSize: "1.1rem",
                fontWeight: "600",
                color: "#B38079",
                margin: 0,
                background: "linear-gradient(135deg, #91BFDF, #E3C2D6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                textShadow: "0 1px 2px rgba(179, 128, 121, 0.1)",
              }}
            >
              ✨ Your friendly crypto companion ✨
            </p>
          </div>
        </div>
      </header>

      {/* NFT Name Display - Moved Above 3D Model */}
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
              
              @keyframes gradientShift {
                0%, 100% {
                  background: linear-gradient(135deg, #91BFDF, #E3C2D6, #E2B5BB);
                }
                25% {
                  background: linear-gradient(135deg, #E3C2D6, #E2B5BB, #91BFDF);
                }
                50% {
                  background: linear-gradient(135deg, #E2B5BB, #91BFDF, #E3C2D6);
                }
                75% {
                  background: linear-gradient(135deg, #91BFDF, #E2B5BB, #E3C2D6);
                }
              }
            `}
          </style>
        </div>
      )}
    </>
  );
}
