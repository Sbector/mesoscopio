import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Environment,
  Center,
} from "@react-three/drei";
import { Suspense, useRef, useState } from "react";

// ---------- MODELO ----------
function Model({ url, position = [0, 0, 0] }) {
  const { scene } = useGLTF(url);
  return (
    <group position={position}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

// ---------- VIEWER ----------
export default function ModelViewer({ model, model2 }) {
  const hasTwoModels = model && model2;
  const containerRef = useRef();
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 🔥 toggle fullscreen
  const toggleFullscreen = async () => {
    const el = containerRef.current;

    if (!document.fullscreenElement) {
      await el.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative bg-neutral-900 rounded-xl overflow-hidden ${
        isFullscreen ? "w-screen h-screen" : "w-[500px] h-[500px]"
      }`}
    >
      {/* 🔳 botón fullscreen */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-3 right-3 z-10 bg-black/60 text-white px-3 py-1 rounded-md text-sm hover:bg-black/80"
      >
        {isFullscreen ? "Salir" : "Fullscreen"}
      </button>

      <Canvas camera={{ position: [0, 0.3, 0.5], fov: 35 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        <Suspense fallback={null}>
          {model && (
            <Model url={model} position={[0, 0, 0]} />
          )}

          {model2 && (
            <Model url={model2} position={[0, 0.125, -0.032]} />
          )}

          <Environment preset="studio" environmentIntensity={0.3} />
        </Suspense>

        <OrbitControls enableDamping target={[0, 0.06, 0]} />
      </Canvas>
    </div>
  );
}