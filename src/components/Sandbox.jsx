import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Environment,
  TransformControls,
} from "@react-three/drei";
import { Suspense, useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { Box3, Vector3 } from "three";

// ---------- SCENE MODEL ----------
function SceneModel({ 
  instanceId, 
  url, 
  title,
  isSelected, 
  isEditMode,
  onSelect, 
  onRegisterRef, 
  onUnregisterRef 
}) {
  const groupRef = useRef(null);
  const clonedSceneRef = useRef(null);
  const { scene } = useGLTF(url);
  const [isFlashing, setIsFlashing] = useState(false);
  const flashTimeoutRef = useRef(null);

  // Clone and center the scene atomically on first load (using ref guard)
  if (scene && !clonedSceneRef.current) {
    const clone = scene.clone(true);
    
    // Clone materials so each instance has independent materials
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
      }
    });
    
    // Center the geometry at the local origin (0,0,0)
    const box = new Box3().setFromObject(clone);
    const center = new Vector3();
    box.getCenter(center);
    clone.position.sub(center);
    
    clonedSceneRef.current = clone;
  }

  // Register/unregister group ref with parent
  useLayoutEffect(() => {
    if (!groupRef.current) return;
    onRegisterRef(instanceId, groupRef.current);
    return () => onUnregisterRef(instanceId);
  }, [instanceId, onRegisterRef, onUnregisterRef]);

  // Highlight flash on click
  useEffect(() => {
    if (groupRef.current && clonedSceneRef.current) {
      clonedSceneRef.current.traverse((child) => {
        if (child.isMesh) {
          child.material.emissive.setHex(isFlashing ? 0xFFAA00 : 0x000000);
          child.material.emissiveIntensity = isFlashing ? 0.8 : 0;
        }
      });
    }
  }, [isFlashing]);

  const handleClick = () => {
    if (!isEditMode) return;
    
    // Trigger flash
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }
    setIsFlashing(true);
    flashTimeoutRef.current = setTimeout(() => {
      setIsFlashing(false);
    }, 300);
    
    // Call parent select handler
    onSelect(instanceId);
  };

  return (
    <group ref={groupRef} onClick={handleClick}>
      {clonedSceneRef.current && <primitive object={clonedSceneRef.current} />}
    </group>
  );
}

// ---------- SIDEBAR MODEL CARD ----------
function SidebarModelCard({ model, onAdd }) {
  const videoRef = useRef(null);
  const isScrubbing = useRef(false);
  const cachedRect = useRef(null);

  const handlePointerEnter = (e) => {
    if (e.pointerType === 'mouse' && videoRef.current && videoRef.current.duration) {
      isScrubbing.current = true;
    }
  };

  const handlePointerMove = (e) => {
    if (!isScrubbing.current || !videoRef.current || !videoRef.current.duration) return;
    
    const rect = cachedRect.current || e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    videoRef.current.currentTime = ratio * videoRef.current.duration;
  };

  const handlePointerLeave = () => {
    isScrubbing.current = false;
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    cachedRect.current = null;
  };

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse') {
      cachedRect.current = e.currentTarget.getBoundingClientRect();
    }
  };

  return (
    <div
      key={model.id}
      className="group cursor-pointer rounded-lg overflow-hidden hover:shadow-md transition-shadow"
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
    >
      <div className="relative aspect-square bg-earth-100 dark:bg-earth-700 overflow-hidden">
        {model.video ? (
          <video
            ref={videoRef}
            src={model.video}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            muted
            playsInline
            preload="auto"
          />
        ) : model.preview ? (
          <img
            src={model.preview}
            alt={model.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-earth-400 text-sm">
            No preview
          </div>
        )}
      </div>
      <button
        onClick={() => onAdd(model)}
        className="w-full px-3 py-2 bg-clay-500 hover:bg-clay-600 text-white text-sm font-medium transition-colors"
      >
        + Add
      </button>
      <div className="px-3 py-2 bg-earth-50 dark:bg-earth-700">
        <p className="text-sm font-medium text-earth-900 dark:text-earth-50 truncate">
          {model.title}
        </p>
      </div>
    </div>
  );
}
function EditorTransformControls({ object, mode, orbitRef }) {
  const tcRef = useRef(null);

  // Attach dragging-changed listener when TransformControls mounts
  useLayoutEffect(() => {
    if (!tcRef.current || !orbitRef.current) return;
    
    const handleDraggingChange = (event) => {
      orbitRef.current.enabled = !event.value;
    };
    
    tcRef.current.addEventListener('dragging-changed', handleDraggingChange);
    return () => tcRef.current?.removeEventListener('dragging-changed', handleDraggingChange);
  }, [orbitRef]);

  return (
    <TransformControls
      ref={tcRef}
      object={object}
      mode={mode}
    />
  );
}

// ---------- SANDBOX COMPONENT ----------
export default function Sandbox({ modelsJSON }) {
  // Parse models from JSON string passed from Astro
  const models = JSON.parse(modelsJSON || '[]');
  const [sceneModels, setSceneModels] = useState([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [transformMode, setTransformMode] = useState('translate');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [isEditMode, setIsEditMode] = useState(true);

  const groupRefsMap = useRef(new Map());
  const orbitRef = useRef(null);
  const [refsVersion, setRefsVersion] = useState(0);

  // Stable ref handlers with useCallback
  const handleRegisterRef = useCallback((instanceId, ref) => {
    groupRefsMap.current.set(instanceId, ref);
    setRefsVersion(v => v + 1);
  }, []);

  const handleUnregisterRef = useCallback((instanceId) => {
    groupRefsMap.current.delete(instanceId);
    setRefsVersion(v => v + 1);
  }, []);

  // Add model to scene
  const addModel = (model) => {
    const newInstance = {
      instanceId: `${Date.now()}-${Math.random()}`,
      url: model.model,
      title: model.title,
      preview: model.preview,
      video: model.video,
    };
    setSceneModels([...sceneModels, newInstance]);
    if (isEditMode) {
      setSelectedInstanceId(newInstance.instanceId);
    }
  };

  // Remove model from scene
  const removeModel = (instanceId) => {
    setSceneModels(sceneModels.filter((m) => m.instanceId !== instanceId));
    if (selectedInstanceId === instanceId) {
      setSelectedInstanceId(null);
    }
  };

  // Handle keyboard shortcuts for transform mode
  useEffect(() => {
    if (!selectedInstanceId || !isEditMode) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setTransformMode('translate');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setTransformMode('rotate');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setTransformMode('scale');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedInstanceId, isEditMode]);

  // Handle reset
  const handleReset = () => {
    if (selectedInstanceId && groupRefsMap.current.has(selectedInstanceId)) {
      const group = groupRefsMap.current.get(selectedInstanceId);
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      group.scale.set(1, 1, 1);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Canvas */}
      <Canvas camera={{ position: [0, 0, 1.0], fov: 50 }}>
        <color attach="background" args={['#F9FAFB']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        <Suspense fallback={null}>
          {sceneModels.map((model) => (
            <SceneModel
              key={model.instanceId}
              instanceId={model.instanceId}
              url={model.url}
              title={model.title}
              isSelected={selectedInstanceId === model.instanceId}
              isEditMode={isEditMode}
              onSelect={setSelectedInstanceId}
              onRegisterRef={handleRegisterRef}
              onUnregisterRef={handleUnregisterRef}
            />
          ))}
          <Environment preset="studio" environmentIntensity={0.3} />
        </Suspense>

        {isEditMode && selectedInstanceId && groupRefsMap.current.get(selectedInstanceId) && (
          <EditorTransformControls
            object={groupRefsMap.current.get(selectedInstanceId)}
            mode={transformMode}
            orbitRef={orbitRef}
          />
        )}

        <OrbitControls
          ref={orbitRef}
          enableDamping
          enableZoom={true}
          enablePan={true}
        />
      </Canvas>

      {/* Models Panel - Sidebar */}
      <div className={`absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-earth-800 shadow-lg transition-transform duration-300 z-30 overflow-y-auto ${
        isPanelOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-4">
          <h2 className="text-lg font-bold text-earth-900 dark:text-earth-50 mb-4">Models</h2>
          <div className="space-y-3 pb-16">
            {models.map((model) => (
              <SidebarModelCard
                key={model.id}
                model={model}
                onAdd={addModel}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Toggle Panel Button */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="absolute left-4 bottom-4 z-20 p-3 rounded-lg bg-earth-200 dark:bg-earth-700 hover:bg-earth-300 dark:hover:bg-earth-600 text-earth-900 dark:text-earth-50 transition-colors"
        title={isPanelOpen ? 'Hide panel' : 'Show panel'}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          {isPanelOpen ? (
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>
      {/* Edit Mode Toggle Button */}
      <button
        onClick={() => {
          setIsEditMode(!isEditMode);
          if (!isEditMode) {
            // Stay on current selection when entering edit mode
          } else {
            // Clear selection when exiting edit mode
            setSelectedInstanceId(null);
          }
        }}
        className={`absolute top-4 left-72 z-40 p-3 rounded-lg transition-colors ${
          isEditMode
            ? 'bg-clay-500 text-white hover:bg-clay-600'
            : 'bg-earth-200 text-earth-900 hover:bg-earth-300 dark:bg-earth-700 dark:text-earth-50 dark:hover:bg-earth-600'
        }`}
        title={isEditMode ? 'Exit edit mode (view only)' : 'Enter edit mode'}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          {isEditMode ? (
            // Pencil icon (edit mode on)
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          ) : (
            // Eye icon (view mode on)
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
          )}
        </svg>
      </button>

      {/* Transform Toolbar - Only visible in edit mode */}
      {isEditMode && selectedInstanceId && (
        <div className="absolute top-4 right-4 z-20 bg-white dark:bg-earth-900 rounded-lg shadow-lg p-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setTransformMode('translate')}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                transformMode === 'translate'
                  ? 'bg-clay-500 text-white'
                  : 'bg-earth-100 text-earth-900 hover:bg-earth-200 dark:bg-earth-800 dark:text-earth-50 dark:hover:bg-earth-700'
              }`}
              title="Move (M)"
            >
              {/* 4-way move arrows */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M12 6v12M6 12h12" />
              </svg>
            </button>
            <button
              onClick={() => setTransformMode('rotate')}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                transformMode === 'rotate'
                  ? 'bg-clay-500 text-white'
                  : 'bg-earth-100 text-earth-900 hover:bg-earth-200 dark:bg-earth-800 dark:text-earth-50 dark:hover:bg-earth-700'
              }`}
              title="Rotate (R)"
            >
              {/* Circular rotation arrow */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-2.6-6.36" />
                <path d="M21 3v4.5h-4.5" />
              </svg>
            </button>
            <button
              onClick={() => setTransformMode('scale')}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                transformMode === 'scale'
                  ? 'bg-clay-500 text-white'
                  : 'bg-earth-100 text-earth-900 hover:bg-earth-200 dark:bg-earth-800 dark:text-earth-50 dark:hover:bg-earth-700'
              }`}
              title="Scale (S)"
            >
              {/* Diagonal expand arrows */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-2 rounded text-sm font-medium bg-earth-100 text-earth-900 hover:bg-earth-200 dark:bg-earth-800 dark:text-earth-50 dark:hover:bg-earth-700 transition-colors"
            title="Reset to original transform"
          >
            Reset
          </button>
          <button
            onClick={() => removeModel(selectedInstanceId)}
            className="px-3 py-2 rounded text-sm font-medium bg-red-100 text-red-900 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 transition-colors"
            title="Remove from scene"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
