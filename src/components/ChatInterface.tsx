import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  inputMessage: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
}

export default function ChatInterface({
  messages,
  isLoading,
  inputMessage,
  onInputChange,
  onSendMessage,
}: ChatInterfaceProps) {
  return (
    <>
      {/* Comic-Style Message Box - Below 3D Model */}
      <div
        style={{
          margin: "0 16px 32px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            maxWidth: "600px",
            width: "100%",
          }}
        >
          {/* Message Box with Tail */}
          <div
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              borderRadius: "20px",
              padding: "20px 24px",
              boxShadow: "0 8px 25px rgba(179, 128, 121, 0.2)",
              border: "3px solid rgba(179, 128, 121, 0.3)",
              position: "relative",
              minHeight: "80px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Speech Bubble Tail */}
            <div
              style={{
                position: "absolute",
                top: "-15px",
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "15px solid transparent",
                borderRight: "15px solid transparent",
                borderBottom: "15px solid rgba(255, 255, 255, 0.95)",
                filter: "drop-shadow(0 -2px 4px rgba(179, 128, 121, 0.2))",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "-18px",
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "18px solid transparent",
                borderRight: "18px solid transparent",
                borderBottom: "18px solid rgba(179, 128, 121, 0.3)",
                zIndex: -1,
              }}
            />

            {/* Message Content */}
            {messages.length === 0 ? (
              <div
                style={{
                  color: "#B38079",
                  fontSize: "16px",
                  textAlign: "center",
                  fontStyle: "italic",
                }}
              >
                💬 Ask LabuBank anything about crypto!
              </div>
            ) : messages[messages.length - 1]?.sender === "ai" ? (
              <div
                style={{
                  color: "#B38079",
                  fontSize: "16px",
                  lineHeight: "1.6",
                  width: "100%",
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <div style={{ margin: "0 0 8px 0" }}>{children}</div>
                    ),
                    h1: ({ children }) => (
                      <h1
                        style={{
                          fontSize: "18px",
                          fontWeight: "bold",
                          margin: "0 0 8px 0",
                        }}
                      >
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2
                        style={{
                          fontSize: "16px",
                          fontWeight: "bold",
                          margin: "0 0 8px 0",
                        }}
                      >
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3
                        style={{
                          fontSize: "15px",
                          fontWeight: "bold",
                          margin: "0 0 8px 0",
                        }}
                      >
                        {children}
                      </h3>
                    ),
                    ul: ({ children }) => (
                      <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol style={{ margin: "8px 0", paddingLeft: "20px" }}>
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li style={{ margin: "4px 0" }}>{children}</li>
                    ),
                    code: ({ children, className }) => {
                      const isInline =
                        !className || !className.includes("language-");
                      return isInline ? (
                        <code
                          style={{
                            backgroundColor: "rgba(179, 128, 121, 0.1)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontFamily: "monospace",
                            fontSize: "13px",
                          }}
                        >
                          {children}
                        </code>
                      ) : (
                        <pre
                          style={{
                            backgroundColor: "rgba(179, 128, 121, 0.1)",
                            padding: "12px",
                            borderRadius: "8px",
                            overflow: "auto",
                            margin: "8px 0",
                          }}
                        >
                          <code>{children}</code>
                        </pre>
                      );
                    },
                    blockquote: ({ children }) => (
                      <blockquote
                        style={{
                          borderLeft: "3px solid rgba(179, 128, 121, 0.3)",
                          paddingLeft: "12px",
                          margin: "8px 0",
                          fontStyle: "italic",
                        }}
                      >
                        {children}
                      </blockquote>
                    ),
                    strong: ({ children }) => (
                      <strong style={{ fontWeight: "bold" }}>{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em style={{ fontStyle: "italic" }}>{children}</em>
                    ),
                  }}
                >
                  {messages[messages.length - 1].text}
                </ReactMarkdown>
              </div>
            ) : isLoading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  color: "#B38079",
                  fontSize: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "2px",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#B38079",
                      animation: "typingDot 1.4s infinite ease-in-out",
                    }}
                  />
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#B38079",
                      animation: "typingDot 1.4s infinite ease-in-out 0.2s",
                    }}
                  />
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#B38079",
                      animation: "typingDot 1.4s infinite ease-in-out 0.4s",
                    }}
                  />
                </div>
                <span>LabuBank is typing...</span>
              </div>
            ) : (
              <div
                style={{
                  color: "#B38079",
                  fontSize: "16px",
                  textAlign: "center",
                  fontStyle: "italic",
                }}
              >
                💬 Ask LabuBank anything about crypto!
              </div>
            )}
          </div>

          {/* CSS Animations for Typing Effect */}
          <style>
            {`
              @keyframes typingDot {
                0%, 60%, 100% {
                  transform: translateY(0);
                  opacity: 0.4;
                }
                30% {
                  transform: translateY(-10px);
                  opacity: 1;
                }
              }
            `}
          </style>
        </div>
      </div>

      {/* Fixed Chat Bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "20px 16px 40px",
          background:
            "linear-gradient(180deg, transparent 0%, rgba(145, 191, 223, 0.1) 50%, rgba(145, 191, 223, 0.3) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && onSendMessage()}
            placeholder="Ask LabuBank about crypto..."
            style={{
              flex: 1,
              padding: "16px 20px",
              borderRadius: "28px",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              fontSize: "16px",
              outline: "none",
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              color: "white",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
            }}
          />
          <button
            onClick={onSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            style={{
              padding: "16px 20px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #91BFDF, #E3C2D6)",
              color: "white",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
              fontWeight: "bold",
              opacity: isLoading || !inputMessage.trim() ? 0.5 : 1,
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
              transition: "all 0.3s ease",
              minWidth: "56px",
              minHeight: "56px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseOver={(e) => {
              if (!isLoading && inputMessage.trim()) {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.boxShadow =
                  "0 12px 40px rgba(0, 0, 0, 0.3)";
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.2)";
            }}
          >
            {isLoading ? "⏳" : "💬"}
          </button>
        </div>
      </div>
    </>
  );
}
