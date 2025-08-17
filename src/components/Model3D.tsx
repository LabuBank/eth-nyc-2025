import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

function LabubankModel() {
  const { scene } = useGLTF("/labubank.glb");
  return <primitive object={scene} scale={3} />;
}

export default function Model3D() {
  return (
    <div
      style={{
        height: "400px",
        margin: "0 16px 32px",
        backgroundColor: "rgba(227, 211, 228, 0.3)",
        borderRadius: "24px",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(227, 194, 214, 0.4)",
      }}
    >
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[10, 10, 5]} intensity={2} />
        <directionalLight position={[-10, -10, -5]} intensity={1} />
        <pointLight position={[0, 10, 0]} intensity={1} />
        <Suspense fallback={null}>
          <LabubankModel />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={true}
          autoRotateSpeed={2}
        />
      </Canvas>
    </div>
  );
}
