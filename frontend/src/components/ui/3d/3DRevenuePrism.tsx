import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function RevenuePrism3D({ size = 70 }: { size?: number }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.z = 4.0

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)

    const prismGeo = new THREE.OctahedronGeometry(1.3, 0)
    const prismMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.15,
      metalness: 0.85,
      wireframe: false,
    })
    const prism = new THREE.Mesh(prismGeo, prismMat)
    scene.add(prism)

    const wireMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, wireframe: true })
    const wire = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), wireMat)
    scene.add(wire)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)

    const light1 = new THREE.DirectionalLight(0x22c55e, 2.0)
    light1.position.set(3, 4, 5)
    scene.add(light1)

    let reqId: number
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      prism.rotation.y += 0.018
      prism.rotation.x += 0.009
      wire.rotation.y -= 0.012
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(reqId)
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [size])

  return (
    <div
      ref={mountRef}
      style={{ width: size, height: size, flexShrink: 0 }}
      title="3D Revenue Diamond"
      aria-hidden="true"
    />
  )
}
