import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Center } from "@react-three/drei";
import { Suspense } from "react";

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

export default function ModelViewer({ model, model2 }) {
  const hasTwoModels = model && model2;

  return (
    <div className="w-125 h-125 bg-neutral-900 rounded-xl overflow-hidden">
      <Canvas camera={{ position: [0, 0.3, 0.5], fov: 35 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        <Suspense fallback={null}>
          {/* Modelo principal */}
          {model && (
            <Model
              url={model}
              position={hasTwoModels ? [0, 0, 0] : [0, 0, 0]}
            />
          )}

          {/* Segundo modelo */}
          {model2 && (
            <Model
              url={model2}
              position={[0, 0.125, -0.032]}
            />
          )}

          <Environment preset="studio" environmentIntensity={0.3}/>
        </Suspense>

        <OrbitControls enableDamping target={[0, 0.06, 0]}/>
      </Canvas>
    </div>
  );
}