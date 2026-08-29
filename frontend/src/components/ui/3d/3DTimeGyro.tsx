import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function TimeGyro3D({ size = 70 }: { size?: number }) {
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

    // Outer Ring
    const r1Geo = new THREE.TorusGeometry(1.4, 0.05, 16, 80)
    const r1Mat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.3, metalness: 0.7 })
    const r1 = new THREE.Mesh(r1Geo, r1Mat)
    group.add(r1)

    // Inner Ring
    const r2Geo = new THREE.TorusGeometry(1.0, 0.04, 16, 60)
    const r2Mat = new THREE.MeshStandardMaterial({ color: 0x0891b2, roughness: 0.3, metalness: 0.7 })
    const r2 = new THREE.Mesh(r2Geo, r2Mat)
    r2.rotation.x = Math.PI / 3
    group.add(r2)

    // Center Core Node
    const coreGeo = new THREE.OctahedronGeometry(0.5, 0)
    const coreMat = new THREE.MeshPhongMaterial({ color: 0x14b8a6, emissive: 0x14b8a6, emissiveIntensity: 0.6 })
    const core = new THREE.Mesh(coreGeo, coreMat)
    group.add(core)

    const light = new THREE.DirectionalLight(0xffffff, 1.2)
    light.position.set(3, 3, 5)
    scene.add(light)
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))

    let reqId: number
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      r1.rotation.z += 0.015
      r2.rotation.y += 0.02
      core.rotation.x += 0.01
      core.rotation.y += 0.015
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
      title="3D Time Slot Gyro"
      aria-hidden="true"
    />
  )
}
