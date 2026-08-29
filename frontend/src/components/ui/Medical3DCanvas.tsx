import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function Medical3DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // ── Scene setup ──────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    camera.position.z = 18

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // ── Group container for rotation ──────────────────────────────────────────
    const helixGroup = new THREE.Group()
    scene.add(helixGroup)

    // ── 3D DNA Double Helix Mesh & Particles ─────────────────────────────────
    const sphereGeo = new THREE.SphereGeometry(0.18, 16, 16)
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x0d9488,
      transparent: true,
      opacity: 0.35,
    })
    const tealMat = new THREE.MeshPhongMaterial({
      color: 0x0d9488,
      emissive: 0x0d9488,
      emissiveIntensity: 0.4,
      shininess: 80,
    })
    const cyanMat = new THREE.MeshPhongMaterial({
      color: 0x0891b2,
      emissive: 0x0891b2,
      emissiveIntensity: 0.4,
      shininess: 80,
    })

    const numPoints = 28
    const helixRadius = 2.8
    const heightSpan = 12

    for (let i = 0; i < numPoints; i++) {
      const t = (i / numPoints) * Math.PI * 4
      const y = (i / numPoints) * heightSpan - heightSpan / 2

      // Strand 1
      const x1 = Math.cos(t) * helixRadius
      const z1 = Math.sin(t) * helixRadius
      const node1 = new THREE.Mesh(sphereGeo, tealMat)
      node1.position.set(x1, y, z1)
      helixGroup.add(node1)

      // Strand 2
      const x2 = Math.cos(t + Math.PI) * helixRadius
      const z2 = Math.sin(t + Math.PI) * helixRadius
      const node2 = new THREE.Mesh(sphereGeo, cyanMat)
      node2.position.set(x2, y, z2)
      helixGroup.add(node2)

      // Connecting rung
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, y, z1),
        new THREE.Vector3(x2, y, z2),
      ])
      const line = new THREE.Line(lineGeo, lineMat)
      helixGroup.add(line)
    }

    // ── Ambient Floating Particles ───────────────────────────────────────────
    const particleCount = 60
    const particleGeo = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i]     = (Math.random() - 0.5) * 16
      positions[i + 1] = (Math.random() - 0.5) * 16
      positions[i + 2] = (Math.random() - 0.5) * 16
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const particleMat = new THREE.PointsMaterial({
      color: 0x5eead4,
      size: 0.12,
      transparent: true,
      opacity: 0.6,
    })
    const particles = new THREE.Points(particleGeo, particleMat)
    scene.add(particles)

    // ── Outer Glowing Pulse Rings ───────────────────────────────────────────
    const ringGeo = new THREE.TorusGeometry(4.2, 0.02, 16, 100)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x14b8a6,
      transparent: true,
      opacity: 0.25,
    })
    const ring1 = new THREE.Mesh(ringGeo, ringMat)
    ring1.rotation.x = Math.PI / 3
    scene.add(ring1)

    const ring2 = new THREE.Mesh(ringGeo, ringMat)
    ring2.rotation.y = Math.PI / 4
    scene.add(ring2)

    // ── Lights ──────────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const pointLight = new THREE.PointLight(0x0d9488, 2, 50)
    pointLight.position.set(5, 5, 10)
    scene.add(pointLight)

    const cyanLight = new THREE.PointLight(0x0891b2, 1.8, 50)
    cyanLight.position.set(-5, -5, 10)
    scene.add(cyanLight)

    // ── Mouse Interactivity ─────────────────────────────────────────────────
    let mouseX = 0
    let mouseY = 0
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseX = ((e.clientX - rect.left) / container.clientWidth - 0.5) * 0.8
      mouseY = ((e.clientY - rect.top) / container.clientHeight - 0.5) * 0.8
    }
    window.addEventListener('mousemove', handleMouseMove)

    // ── Resize Handler ──────────────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    // ── Animation Loop ──────────────────────────────────────────────────────
    let animationFrameId: number
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      // Smooth rotation
      helixGroup.rotation.y += 0.008
      helixGroup.rotation.x += (mouseY - helixGroup.rotation.x) * 0.05
      helixGroup.rotation.z += (mouseX - helixGroup.rotation.z) * 0.05

      ring1.rotation.z += 0.003
      ring2.rotation.z -= 0.003
      particles.rotation.y += 0.001

      renderer.render(scene, camera)
    }
    animate()

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.85,
      }}
      aria-hidden="true"
    />
  )
}
