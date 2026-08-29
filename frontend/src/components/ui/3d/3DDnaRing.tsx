import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function DnaRing3D({ size = 70 }: { size?: number }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.z = 3.8

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(size, size)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)

    const dnaGroup = new THREE.Group()
    scene.add(dnaGroup)

    const sphereGeo = new THREE.SphereGeometry(0.12, 12, 12)
    const tealMat = new THREE.MeshPhongMaterial({ color: 0x0d9488, emissive: 0x0d9488, emissiveIntensity: 0.5 })
    const cyanMat = new THREE.MeshPhongMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.5 })
    const lineMat = new THREE.LineBasicMaterial({ color: 0x0d9488, transparent: true, opacity: 0.4 })

    const count = 12
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const y = (i / count) * 2.8 - 1.4
      const x1 = Math.cos(angle) * 1.1
      const z1 = Math.sin(angle) * 1.1
      const x2 = Math.cos(angle + Math.PI) * 1.1
      const z2 = Math.sin(angle + Math.PI) * 1.1

      const m1 = new THREE.Mesh(sphereGeo, tealMat)
      m1.position.set(x1, y, z1)
      dnaGroup.add(m1)

      const m2 = new THREE.Mesh(sphereGeo, cyanMat)
      m2.position.set(x2, y, z2)
      dnaGroup.add(m2)

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, y, z1),
        new THREE.Vector3(x2, y, z2),
      ])
      dnaGroup.add(new THREE.Line(lineGeo, lineMat))
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9)
    scene.add(ambientLight)

    let reqId: number
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      dnaGroup.rotation.y += 0.02
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
      title="3D Patient DNA Registry"
      aria-hidden="true"
    />
  )
}
