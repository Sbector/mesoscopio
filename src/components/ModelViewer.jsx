import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Environment,
  Center,
} from "@react-three/drei";
import { Suspense } from "react";

// ---------- MODELO ----------
function Model({ url }) {
  const { scene } = useGLTF(url);

  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

// ---------- VIEWER ----------
export default function ModelViewer({ model }) {
  return (
    <div className="w-full h-125 bg-neutral-900 rounded-xl overflow-hidden">
      <Canvas camera={{ position: [0, 0.3, 0.5], fov: 35 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        <Suspense fallback={null}>
          {model && <Model url={model} />}
          <Environment preset="studio" environmentIntensity={0.3} />
        </Suspense>

        <OrbitControls enableDamping target={[0, 0.06, 0]} />
      </Canvas>
    </div>
  );
}