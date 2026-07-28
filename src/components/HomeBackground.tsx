"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const STAR_COUNT = 2200;
const FIELD_DEPTH = 140;
const FIELD_SPREAD = 55;
const TRAVEL_SPEED = 0.018;

function createStarTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.Texture();
  }
  const c = size / 2;
  const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function placeStar(
  positions: Float32Array,
  colors: Float32Array,
  index: number,
  near = false
) {
  const i3 = index * 3;
  const radius = Math.pow(Math.random(), 0.65) * FIELD_SPREAD;
  const theta = Math.random() * Math.PI * 2;
  positions[i3] = Math.cos(theta) * radius;
  positions[i3 + 1] = Math.sin(theta) * radius * 0.72;
  positions[i3 + 2] = near
    ? -2 - Math.random() * 8
    : -8 - Math.random() * FIELD_DEPTH;

  const shade = 0.72 + Math.random() * 0.28;
  const cool = Math.random() > 0.88;
  colors[i3] = cool ? shade * 0.82 : shade;
  colors[i3 + 1] = cool ? shade * 0.88 : shade;
  colors[i3 + 2] = shade;
}

export function HomeBackground({ active = true }: { active?: boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    let disposed = false;
    let frame = 0;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050508, 0.012);

    const camera = new THREE.PerspectiveCamera(
      58,
      Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1),
      0.1,
      200
    );
    camera.position.set(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x050508, 1);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    mount.appendChild(renderer.domElement);

    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i += 1) {
      placeStar(positions, colors, i);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.085,
      map: createStarTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexColors: true,
      opacity: 0.85,
      sizeAttenuation: true,
    });

    const stars = new THREE.Points(geometry, material);
    scene.add(stars);

    // Distant faint cool dust cloud — no warm core
    const dustCount = 280;
    const dustPos = new Float32Array(dustCount * 3);
    const dustCol = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i += 1) {
      const i3 = i * 3;
      const arm = i % 3;
      const t = Math.random();
      const radius = 4 + t * 14;
      const angle = arm * ((Math.PI * 2) / 3) + t * 3.1 + (Math.random() - 0.5) * 0.4;
      dustPos[i3] = Math.cos(angle) * radius * 1.2 + 8;
      dustPos[i3 + 1] = Math.sin(angle) * radius * 0.45 - 2;
      dustPos[i3 + 2] = -70 - Math.random() * 40;
      const tone = 0.25 + Math.random() * 0.2;
      dustCol[i3] = tone * 0.7;
      dustCol[i3 + 1] = tone * 0.8;
      dustCol[i3 + 2] = tone;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute("color", new THREE.BufferAttribute(dustCol, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.12,
      map: createStarTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexColors: true,
      opacity: 0.22,
      sizeAttenuation: true,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    const resize = () => {
      const w = Math.max(mount.clientWidth, 1);
      const h = Math.max(mount.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
    };

    const positionAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;

    const tick = () => {
      if (disposed) {
        return;
      }
      frame = window.requestAnimationFrame(tick);

      if (!activeRef.current) {
        return;
      }

      const arr = positionAttr.array as Float32Array;
      for (let i = 0; i < STAR_COUNT; i += 1) {
        const i3 = i * 3;
        // Travel forward through the field — depth-based so near stars feel faster
        const depthFactor = 0.45 + Math.min(1, Math.abs(arr[i3 + 2]) / FIELD_DEPTH) * 0.55;
        arr[i3 + 2] += TRAVEL_SPEED * depthFactor;

        if (arr[i3 + 2] > 2) {
          placeStar(arr, colors, i);
          arr[i3 + 2] = -FIELD_DEPTH - Math.random() * 20;
          colorAttr.needsUpdate = true;
        }
      }
      positionAttr.needsUpdate = true;

      dust.rotation.z += 0.00008;
      camera.rotation.z = Math.sin(performance.now() * 0.00005) * 0.015;

      renderer.render(scene, camera);
    };

    resize();
    frame = window.requestAnimationFrame(tick);
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
      dustGeo.dispose();
      dustMat.map?.dispose();
      dustMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
