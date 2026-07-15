import { Grid } from '@react-three/drei'

export default function GridHelper({
  cellSize = 0.05,
  sectionSize = 0.25,
  fadeDistance = 25,
  infiniteGrid = true,
  cellColor = '#d1d5db',
  sectionColor = '#9ca3af',
  position = [0, -0.001, 0],
}) {
  return (
    <Grid
      args={[20, 20]}
      cellSize={cellSize}
      cellThickness={0.6}
      cellColor={cellColor}
      sectionSize={sectionSize}
      sectionThickness={1}
      sectionColor={sectionColor}
      fadeDistance={fadeDistance}
      fadeStrength={1}
      infiniteGrid={infiniteGrid}
      followCamera={false}
      position={position}
    />
  )
}
