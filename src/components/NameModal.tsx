import React from "react";

interface NameModalProps {
  isOpen: boolean;
  newName: string;
  isNaming: boolean;
  onNameChange: (name: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function NameModal({
  isOpen,
  newName,
  isNaming,
  onNameChange,
  onConfirm,
  onCancel,
}: NameModalProps) {
  if (!isOpen) return null;

  return (
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
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "16px",
          padding: "24px",
          maxWidth: "400px",
          width: "100%",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
        }}
      >
        <h3
          style={{
            fontSize: "1.5rem",
            fontWeight: "bold",
            marginBottom: "16px",
            color: "#B38079",
            textAlign: "center",
          }}
        >
          Name Your Labubank
        </h3>

        <input
          type="text"
          value={newName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Enter a name for your Labubank..."
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "12px",
            border: "2px solid rgba(227, 194, 214, 0.5)",
            fontSize: "16px",
            outline: "none",
            marginBottom: "20px",
            boxSizing: "border-box",
          }}
          maxLength={50}
        />

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={onCancel}
            disabled={isNaming}
            style={{
              flex: 1,
              padding: "12px 20px",
              borderRadius: "12px",
              backgroundColor: "#f0f0f0",
              color: "#666",
              border: "none",
              cursor: isNaming ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "bold",
              opacity: isNaming ? 0.5 : 1,
            }}
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={isNaming || !newName.trim()}
            style={{
              flex: 1,
              padding: "12px 20px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #91BFDF, #E3C2D6)",
              color: "white",
              border: "none",
              cursor: isNaming || !newName.trim() ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "bold",
              opacity: isNaming || !newName.trim() ? 0.5 : 1,
            }}
          >
            {isNaming ? "Naming..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
