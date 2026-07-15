import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Environment,
  Bounds,
  Center,
} from "@react-three/drei";
import { Suspense, useState, useRef, useEffect, useLayoutEffect } from "react";
import { Box3, Vector3 } from "three";

// ---------- MODELO ----------
function Model({ url }) {
  const { scene } = useGLTF(url);

  // Center the geometry at the local origin (0,0,0)
  useLayoutEffect(() => {
    if (!scene) return;
    
    const box = new Box3().setFromObject(scene);
    const center = new Vector3();
    box.getCenter(center);
    
    // Shift the geometry so its center aligns with local origin
    scene.position.sub(center);
  }, [scene]);

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
    <div ref={containerRef} className="model-viewer-container relative w-full h-full bg-earth-50 rounded-xl overflow-hidden">
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

      {/* "View in 3D" button — triggers fullscreen (mobile friendly) */}
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center p-3 rounded-xl bg-clay-500 text-earth-50 hover:bg-clay-600 active:bg-clay-700 transition-colors shadow-lg"
        title={isFullscreen ? "Salir de pantalla completa" : "Ver en 3D (pantalla completa)"}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M4 16v4h4m8 0h4v-4" />
        </svg>
      </button>

      {/* Auto-rotate toggle button (top-right, larger touch target) */}
      <button
        onClick={() => setAutoRotate(!autoRotate)}
        className="absolute top-4 right-4 z-10 p-3 rounded-xl bg-earth-200 text-earth-900 hover:bg-earth-300 dark:bg-earth-700 dark:text-earth-50 dark:hover:bg-earth-600 active:scale-95 transition-all"
        title={autoRotate ? "Detener rotación" : "Iniciar rotación"}
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          {autoRotate ? (
            // Pause icon
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          ) : (
            // Play icon
            <path d="M8 5v14l11-7z" />
          )}
        </svg>
      </button>
    </div>
  );
}