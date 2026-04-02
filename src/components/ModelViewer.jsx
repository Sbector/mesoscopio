import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Center } from "@react-three/drei";
import { Suspense } from "react";

function Model({ url }) {
    const { scene } = useGLTF(url);
    return <primitive object={scene} />;
}

export default function ModelViewer({ model }) {
    return (
        <div className="w-125 h-125 bg-neutral-900 rounded-xl overflow-hidden">
            <Canvas camera={{ position: [-0.15, 0.15, 0.15], fov: 45 }}>
                <ambientLight intensity={1} />
                <directionalLight position={[5, 5, 5]} intensity={1} />

                <Suspense fallback={null}>
                    <Center>
                        <Model url={model} />
                    </Center>
                    <Environment preset="studio" environmentIntensity={0.3}/>
                </Suspense>

                <OrbitControls enableDamping />
            </Canvas>
        </div>
    );
}