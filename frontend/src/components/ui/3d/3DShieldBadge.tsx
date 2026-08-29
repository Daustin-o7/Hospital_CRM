import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function ShieldBadge3D({ size = 70 }: { size?: number }) {
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

    const group = new THREE.Group()
    scene.add(group)

    // Outer Shield Frame
    const shieldShape = new THREE.Shape()
    shieldShape.moveTo(0, 1.3)
    shieldShape.quadraticCurveTo(1.2, 1.1, 1.2, 0.2)
    shieldShape.quadraticCurveTo(1.2, -0.9, 0, -1.5)
    shieldShape.quadraticCurveTo(-1.2, -0.9, -1.2, 0.2)
    shieldShape.quadraticCurveTo(-1.2, 1.1, 0, 1.3)

    const extrudeSettings = { depth: 0.18, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 }
    const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, extrudeSettings)
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.2, metalness: 0.8 })
    const shield = new THREE.Mesh(shieldGeo, shieldMat)
    group.add(shield)

    // Inner Glowing Badge Ring
    const ringGeo = new THREE.TorusGeometry(0.5, 0.05, 16, 40)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x5eead4 })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.position.z = 0.15
    group.add(ring)

    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const light = new THREE.DirectionalLight(0x0d9488, 2)
    light.position.set(3, 3, 5)
    scene.add(light)

    let reqId: number
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      group.rotation.y += 0.02
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
      title="3D Security Shield Badge"
      aria-hidden="true"
    />
  )
}
