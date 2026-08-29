import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function HeroOrb3D({ size = 80 }: { size?: number }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.z = 4.2

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)

    // Inner Glowing Core
    const coreGeo = new THREE.IcosahedronGeometry(1.0, 2)
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x0d9488,
      emissive: 0x0d9488,
      emissiveIntensity: 0.6,
      wireframe: true,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    scene.add(core)

    // Outer Gyro Ring
    const ringGeo = new THREE.TorusGeometry(1.5, 0.04, 16, 60)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x0891b2,
      roughness: 0.2,
      metalness: 0.8,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 4
    scene.add(ring)

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    scene.add(ambientLight)
    const pointLight = new THREE.PointLight(0x14b8a6, 2, 20)
    pointLight.position.set(2, 2, 4)
    scene.add(pointLight)

    let reqId: number
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      core.rotation.y += 0.015
      core.rotation.x += 0.008
      ring.rotation.z -= 0.02
      ring.rotation.y += 0.01
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
      style={{ width: size, height: size, flexShrink: 0, cursor: 'pointer' }}
      title="Live Vitality Orb"
      aria-hidden="true"
    />
  )
}
