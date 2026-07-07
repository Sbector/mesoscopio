import { Canvas } from "@react-three/fiber";
import {
  useGLTF,
  Environment,
  Bounds,
  Center,
} from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";

// Model loader component
function Model({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

// Main render viewer
export default function RenderViewer() {
  const modelRef = useRef(null);
  const readyRef = useRef(false);

  useEffect(() => {
    // Extract model URL from query params
    const params = new URLSearchParams(window.location.search);
    const modelUrl = params.get("model");

    if (!modelUrl) {
      console.error("No model URL provided");
      return;
    }

    // Expose setRotation for Playwright control
    window.setRotation = (angle) => {
      if (modelRef.current) {
        modelRef.current.rotation.y = angle;
      }
    };

    // Signal when ready for rendering
    // Wait 2 rAF cycles to ensure textures are painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.__MODEL_RENDER_READY = true;
      });
    });
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      gl={{
        preserveDrawingBuffer: true,
        antialias: true,
        alpha: true,
        pixelRatio: 1,
      }}
      frameloop="always"
      style={{
        width: "480px",
        height: "480px",
        display: "block",
      }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />

      <Suspense fallback={null}>
        <Bounds fit clip padding={1.2}>
          <Center ref={modelRef}>
            <Model url={new URLSearchParams(window.location.search).get("model")} />
          </Center>
        </Bounds>
        <Environment preset="studio" environmentIntensity={0.3} />
      </Suspense>
    </Canvas>
  );
}
