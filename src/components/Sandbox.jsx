import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  TransformControls,
  Environment,
} from "@react-three/drei";
import { Suspense, useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { Box3, Vector3 } from "three";
import GridHelper from "@/components/three/GridHelper.jsx";

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
  const [showGrid, setShowGrid] = useState(false);
  const [envIntensity, setEnvIntensity] = useState(0.3);

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
        <color attach="background" args={['#ffffff']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <Environment preset="studio" environmentIntensity={envIntensity} />

        {showGrid && <GridHelper />}

        {sceneModels.map((model) => (
          <Suspense key={model.instanceId} fallback={null}>
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
          </Suspense>
        ))}

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
        className={`absolute top-4 left-72 z-40 p-3 rounded-lg transition-colors border ${
          isEditMode
            ? 'border-clay-500 text-clay-600 dark:text-clay-400'
            : 'border-earth-300 text-earth-600 hover:bg-earth-100 dark:border-earth-600 dark:text-earth-300 dark:hover:bg-earth-800'
        }`}
        title={isEditMode ? 'Exit edit mode (view only)' : 'Enter edit mode'}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {isEditMode ? (
            // Pencil icon (edit mode on)
            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          ) : (
            // Eye icon (view mode on)
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
          )}
        </svg>
      </button>

      {/* Scene controls */}
      <div className="absolute top-4 right-4 z-20 bg-white dark:bg-earth-900 rounded-lg shadow-lg p-3 flex items-center gap-3">
        {/* Environment intensity */}
        <label className="flex items-center gap-2 text-earth-700 dark:text-earth-300" title="Intensidad de iluminación">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
          <input
            type="range"
            min="0"
            max="0.8"
            step="0.05"
            value={envIntensity}
            onChange={(e) => setEnvIntensity(parseFloat(e.target.value))}
            className="w-20 accent-clay-500 cursor-pointer"
            aria-label="Intensidad de iluminación"
          />
        </label>

        {/* Grid toggle */}
        <button
          onClick={() => setShowGrid(!showGrid)}
          aria-label={showGrid ? "Ocultar grid" : "Mostrar grid"}
          className={`p-1.5 rounded border transition-colors ${
            showGrid
              ? 'border-clay-500 text-clay-600 dark:text-clay-400'
              : 'border-earth-300 text-earth-600 hover:bg-earth-100 dark:border-earth-600 dark:text-earth-300 dark:hover:bg-earth-800'
          }`}
          title={showGrid ? "Ocultar grid" : "Mostrar grid"}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </button>
      </div>

      {/* Transform Toolbar - Only visible in edit mode */}
      {isEditMode && selectedInstanceId && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white dark:bg-earth-900 rounded-lg shadow-lg p-2 flex flex-row items-center gap-2">
          <button
            onClick={() => setTransformMode('translate')}
            aria-label="Move (M)"
            className={`p-2 rounded border transition-colors ${
              transformMode === 'translate'
                ? 'border-clay-500 text-clay-600 dark:text-clay-400'
                : 'border-earth-300 text-earth-600 hover:bg-earth-100 dark:border-earth-600 dark:text-earth-300 dark:hover:bg-earth-800'
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
            aria-label="Rotate (R)"
            className={`relative w-10 h-10 rounded-full border-2 transition-all ${
              transformMode === 'rotate'
                ? 'border-clay-500 text-clay-600 ring-2 ring-clay-400 scale-105 dark:text-clay-400'
                : 'border-earth-300 text-earth-600 hover:bg-earth-100 dark:border-earth-600 dark:text-earth-300 dark:hover:bg-earth-800'
            }`}
            title="Rotate (R)"
          >
            {/* Circular rotation arrow */}
            <svg className="w-5 h-5 absolute inset-0 m-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.6-6.36" />
              <path d="M21 3v4.5h-4.5" />
            </svg>
          </button>
          <button
            onClick={() => setTransformMode('scale')}
            aria-label="Scale (S)"
            className={`p-2 rounded border transition-colors ${
              transformMode === 'scale'
                ? 'border-clay-500 text-clay-600 dark:text-clay-400'
                : 'border-earth-300 text-earth-600 hover:bg-earth-100 dark:border-earth-600 dark:text-earth-300 dark:hover:bg-earth-800'
            }`}
            title="Scale (S)"
          >
            {/* Diagonal expand arrows */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>

          <span className="mx-1 h-6 w-px bg-earth-200 dark:bg-earth-700" />

          <button
            onClick={handleReset}
            aria-label="Reset to original transform"
            className="p-2 rounded border border-earth-300 text-earth-600 hover:bg-earth-100 dark:border-earth-600 dark:text-earth-300 dark:hover:bg-earth-800 transition-colors"
            title="Reset to original transform"
          >
            {/* Refresh / reset arrow */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 2.5-6.7" />
              <path d="M3 4v4h4" />
            </svg>
          </button>
          <button
            onClick={() => removeModel(selectedInstanceId)}
            aria-label="Remove from scene"
            className="p-2 rounded border border-red-400 text-red-600 hover:bg-red-100 dark:border-red-500 dark:text-red-300 dark:hover:bg-red-900/30 transition-colors"
            title="Remove from scene"
          >
            {/* Trash icon */}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
