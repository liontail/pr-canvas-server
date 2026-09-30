import { useRef, useState } from 'preact/hooks'
import { lerpCamera } from './camera.js'

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export function useCamera () {
  const [camera, setCameraState] = useState(null)
  const cameraRef = useRef(null)
  const frame = useRef(0)

  function setCamera (next) {
    cancelAnimationFrame(frame.current)
    cameraRef.current = next
    setCameraState(next)
  }

  function flyTo (target, ms = 600) {
    const from = cameraRef.current
    cancelAnimationFrame(frame.current)
    if (!from || reducedMotion()) return setCamera(target)
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms)
      const next = lerpCamera(from, target, t)
      cameraRef.current = next
      setCameraState(next)
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }

  return { camera, cameraRef, setCamera, flyTo }
}
