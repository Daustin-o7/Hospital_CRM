import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function QueueRadar3D({ size = 70 }: { size?: number }) {
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

    // Concentric Wave Rings
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.5, wireframe: true })
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.03, 16, 60), ringMat)
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.03, 16, 60), ringMat)
    group.add(r1)
    group.add(r2)

    // Center Pulse Beacon
    const beaconGeo = new THREE.SphereGeometry(0.45, 16, 16)
    const beaconMat = new THREE.MeshPhongMaterial({ color: 0x8b5cf6, emissive: 0x7c3aed, emissiveIntensity: 0.8 })
    const beacon = new THREE.Mesh(beaconGeo, beaconMat)
    group.add(beacon)

    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const light = new THREE.PointLight(0xa78bfa, 2, 10)
    light.position.set(2, 2, 4)
    scene.add(light)

    let reqId: number
    let scale = 1
    let expanding = true

    const animate = () => {
      reqId = requestAnimationFrame(animate)
      group.rotation.x = Math.PI / 4
      group.rotation.z += 0.015

      // Pulsing effect
      if (expanding) {
        scale += 0.008
        if (scale > 1.2) expanding = false
      } else {
        scale -= 0.008
        if (scale < 0.85) expanding = true
      }
      beacon.scale.set(scale, scale, scale)

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
      title="3D Live Queue Radar"
      aria-hidden="true"
    />
  )
}
