import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export type HeroCanvasTheme = 'dashboard' | 'patients' | 'appointments' | 'billing' | 'consultations' | 'queue' | 'staff'

interface PageHeroCanvasProps {
  theme?: HeroCanvasTheme
  height?: number
}

export function PageHeroCanvas({ theme = 'dashboard', height = 140 }: PageHeroCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    // ── Setup ──────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    )
    camera.position.z = 12

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const mainGroup = new THREE.Group()
    scene.add(mainGroup)

    // ── Theme-specific 3D Objects ──────────────────────────────────────────────
    if (theme === 'dashboard') {
      // Interactive Floating Grid Mesh & Glowing Nodes
      const planeGeo = new THREE.PlaneGeometry(30, 16, 24, 16)
      const planeMat = new THREE.MeshBasicMaterial({
        color: 0x0d9488,
        wireframe: true,
        transparent: true,
        opacity: 0.18,
      })
      const grid = new THREE.Mesh(planeGeo, planeMat)
      grid.rotation.x = -Math.PI / 3.5
      grid.position.y = -2
      mainGroup.add(grid)

      // Floating pulse spheres
      for (let i = 0; i < 18; i++) {
        const sGeo = new THREE.SphereGeometry(0.18 + Math.random() * 0.12, 12, 12)
        const sMat = new THREE.MeshPhongMaterial({
          color: i % 2 === 0 ? 0x0d9488 : 0x0891b2,
          emissive: i % 2 === 0 ? 0x0d9488 : 0x0891b2,
          emissiveIntensity: 0.5,
        })
        const s = new THREE.Mesh(sGeo, sMat)
        s.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6)
        mainGroup.add(s)
      }
    } else if (theme === 'patients') {
      // 3D DNA Helix strand stretching horizontally
      const numPoints = 32
      const radius = 1.8
      const length = 22
      const sphereGeo = new THREE.SphereGeometry(0.16, 12, 12)
      const tealMat = new THREE.MeshPhongMaterial({ color: 0x0d9488, emissive: 0x0d9488, emissiveIntensity: 0.5 })
      const cyanMat = new THREE.MeshPhongMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.5 })
      const lineMat = new THREE.LineBasicMaterial({ color: 0x0d9488, transparent: true, opacity: 0.3 })

      for (let i = 0; i < numPoints; i++) {
        const t = (i / numPoints) * Math.PI * 4
        const x = (i / numPoints) * length - length / 2
        const y1 = Math.sin(t) * radius
        const z1 = Math.cos(t) * radius
        const y2 = Math.sin(t + Math.PI) * radius
        const z2 = Math.cos(t + Math.PI) * radius

        const m1 = new THREE.Mesh(sphereGeo, tealMat)
        m1.position.set(x, y1, z1)
        mainGroup.add(m1)

        const m2 = new THREE.Mesh(sphereGeo, cyanMat)
        m2.position.set(x, y2, z2)
        mainGroup.add(m2)

        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y1, z1),
          new THREE.Vector3(x, y2, z2),
        ])
        mainGroup.add(new THREE.Line(lineGeo, lineMat))
      }
    } else if (theme === 'appointments' || theme === 'queue') {
      // Orbital Ring Field & Radar Pulse Rings
      const ringGeo = new THREE.TorusGeometry(3.5, 0.03, 16, 80)
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x0891b2, transparent: true, opacity: 0.35 })
      const r1 = new THREE.Mesh(ringGeo, ringMat)
      r1.rotation.x = Math.PI / 3
      mainGroup.add(r1)

      const r2 = new THREE.Mesh(ringGeo, ringMat)
      r2.rotation.y = Math.PI / 4
      mainGroup.add(r2)

      // Orbiting time nodes
      const nodeGeo = new THREE.IcosahedronGeometry(0.3, 0)
      const nodeMat = new THREE.MeshPhongMaterial({ color: 0x14b8a6, emissive: 0x14b8a6, emissiveIntensity: 0.7 })
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        const node = new THREE.Mesh(nodeGeo, nodeMat)
        node.position.set(Math.cos(angle) * 3.5, Math.sin(angle) * 1.5, Math.sin(angle) * 2)
        mainGroup.add(node)
      }
    } else if (theme === 'billing') {
      // 3D Gem Diamond & Coin Waves
      const gemGeo = new THREE.OctahedronGeometry(1.6, 0)
      const gemMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.15, metalness: 0.85 })
      const gem = new THREE.Mesh(gemGeo, gemMat)
      gem.position.set(6, 0, 0)
      mainGroup.add(gem)

      const wireGeo = new THREE.OctahedronGeometry(1.75, 0)
      const wireMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, wireframe: true, transparent: true, opacity: 0.4 })
      const wire = new THREE.Mesh(wireGeo, wireMat)
      wire.position.set(6, 0, 0)
      mainGroup.add(wire)

      // Floating emerald particles
      for (let i = 0; i < 20; i++) {
        const pGeo = new THREE.TetrahedronGeometry(0.18 + Math.random() * 0.1, 0)
        const pMat = new THREE.MeshPhongMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.4 })
        const p = new THREE.Mesh(pGeo, pMat)
        p.position.set((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4)
        mainGroup.add(p)
      }
    } else {
      // Consultations / Staff / Generic Healthcare Helix Wave
      const waveGeo = new THREE.TorusKnotGeometry(2.2, 0.2, 80, 16)
      const waveMat = new THREE.MeshPhongMaterial({
        color: 0x0d9488,
        emissive: 0x0d9488,
        emissiveIntensity: 0.3,
        wireframe: true,
      })
      const knot = new THREE.Mesh(waveGeo, waveMat)
      knot.position.set(7, 0, -1)
      mainGroup.add(knot)
    }

    // ── Ambient Background Particles ───────────────────────────────────────────
    const particleCount = 45
    const particleGeo = new THREE.BufferGeometry()
    const pos = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount * 3; i += 3) {
      pos[i]     = (Math.random() - 0.5) * 28
      pos[i + 1] = (Math.random() - 0.5) * 10
      pos[i + 2] = (Math.random() - 0.5) * 8
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))

    const particleMat = new THREE.PointsMaterial({
      color: 0x5eead4,
      size: 0.1,
      transparent: true,
      opacity: 0.5,
    })
    const particles = new THREE.Points(particleGeo, particleMat)
    scene.add(particles)

    // ── Lighting ───────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const light1 = new THREE.DirectionalLight(0x0d9488, 1.8)
    light1.position.set(5, 5, 8)
    scene.add(light1)

    // ── Mouse Interaction ──────────────────────────────────────────────────────
    let mouseX = 0
    let mouseY = 0
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseX = ((e.clientX - rect.left) / container.clientWidth - 0.5) * 0.4
      mouseY = ((e.clientY - rect.top) / container.clientHeight - 0.5) * 0.4
    }
    window.addEventListener('mousemove', handleMouseMove)

    // ── Resize ─────────────────────────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    // ── Animation Loop ─────────────────────────────────────────────────────────
    let reqId: number
    const animate = () => {
      reqId = requestAnimationFrame(animate)

      mainGroup.rotation.y += 0.005
      mainGroup.rotation.x += (mouseY - mainGroup.rotation.x) * 0.04
      mainGroup.rotation.z += (mouseX - mainGroup.rotation.z) * 0.04
      particles.rotation.y += 0.001

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(reqId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [theme])

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        height,
        width: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        opacity: 0.85,
        borderRadius: 'var(--radius-lg)',
      }}
      aria-hidden="true"
    />
  )
}
