import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function RxCapsule3D({ size = 70 }: { size?: number }) {
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

    const capsuleGroup = new THREE.Group()
    scene.add(capsuleGroup)

    // Capsule Top Half (Teal)
    const topGeo = new THREE.CylinderGeometry(0.65, 0.65, 1.0, 32)
    const topMat = new THREE.MeshPhongMaterial({ color: 0x0d9488, shininess: 90 })
    const topCap = new THREE.Mesh(topGeo, topMat)
    topCap.position.y = 0.5
    capsuleGroup.add(topCap)

    const domeGeo = new THREE.SphereGeometry(0.65, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    const topDome = new THREE.Mesh(domeGeo, topMat)
    topDome.position.y = 1.0
    capsuleGroup.add(topDome)

    // Capsule Bottom Half (Orange/Gold accent)
    const botMat = new THREE.MeshPhongMaterial({ color: 0xd97706, shininess: 90 })
    const botCap = new THREE.Mesh(topGeo, botMat)
    botCap.position.y = -0.5
    capsuleGroup.add(botCap)

    const botDome = new THREE.Mesh(domeGeo, botMat)
    botDome.rotation.x = Math.PI
    botDome.position.y = -1.0
    capsuleGroup.add(botDome)

    capsuleGroup.rotation.z = Math.PI / 6

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambientLight)

    const light1 = new THREE.DirectionalLight(0xffffff, 1.2)
    light1.position.set(4, 4, 6)
    scene.add(light1)

    let reqId: number
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      capsuleGroup.rotation.y += 0.02
      capsuleGroup.rotation.x += 0.008
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
      title="3D Rx Clinical Capsule"
      aria-hidden="true"
    />
  )
}
