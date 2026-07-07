import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Environment,
  Bounds,
  Center,
} from "@react-three/drei";
import { Suspense, useState, useRef, useEffect } from "react";

// ---------- MODELO ----------
function Model({ url }) {
  const { scene } = useGLTF(url);

  return (
    <primitive object={scene} />
  );
}

// ---------- VIEWER ----------
export default function ModelViewer({ model }) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div ref={containerRef} className="model-viewer-container relative w-full h-125 bg-earth-50 rounded-xl overflow-hidden">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <color attach="background" args={['#F9FAFB']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        <Suspense fallback={null}>
          {model && (
            <Bounds fit clip padding={1.2}>
              <Center>
                <Model url={model} />
              </Center>
            </Bounds>
          )}
          <Environment preset="studio" environmentIntensity={0.3} />
        </Suspense>

        <OrbitControls 
          enableDamping 
          enableZoom={true} 
          enablePan={true}
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
        />
      </Canvas>

      {/* Auto-rotate toggle button */}
      <button
        onClick={() => setAutoRotate(!autoRotate)}
        className="absolute bottom-4 left-4 z-10 p-2 rounded-lg bg-earth-200 text-earth-900 hover:bg-earth-300 dark:bg-earth-700 dark:text-earth-50 dark:hover:bg-earth-600 transition-colors"
        title={autoRotate ? "Detener rotación" : "Iniciar rotación"}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          {autoRotate ? (
            // Pause icon
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          ) : (
            // Play icon
            <path d="M8 5v14l11-7z" />
          )}
        </svg>
      </button>

      {/* Fullscreen toggle button */}
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-4 left-14 z-10 p-2 rounded-lg bg-earth-200 text-earth-900 hover:bg-earth-300 dark:bg-earth-700 dark:text-earth-50 dark:hover:bg-earth-600 transition-colors"
        title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          {isFullscreen ? (
            // Exit fullscreen icon
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V5H5m0 4h4M15 9h4V5m0 4h-4M9 15H5v4m4 0v-4m6 4v-4h4m0 0h-4" />
          ) : (
            // Enter fullscreen icon
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M4 16v4h4m8 0h4v-4" />
          )}
        </svg>
      </button>
    </div>
  );
}