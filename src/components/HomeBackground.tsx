"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const STAR_COUNT_DESKTOP = 5600;
const STAR_COUNT_MOBILE = 2400;
const FIELD_DEPTH = 260;
const FIELD_SPREAD_X = 58;
const FIELD_SPREAD_Y = 36;
const DRIFT_RIGHT = 0.02;
const DRIFT_TOWARD = 0.012;

function getStarCount() {
  if (typeof window === "undefined") {
    return STAR_COUNT_DESKTOP;
  }
  return window.innerWidth < 768 ? STAR_COUNT_MOBILE : STAR_COUNT_DESKTOP;
}

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
  gradient.addColorStop(0.22, "rgba(255,255,255,0.75)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.18)");
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
  mode: "full" | "recycle" = "full"
) {
  const i3 = index * 3;
  // Keep depth well populated — recycle across the whole Z range, not only the back
  const depthT = Math.random();

  if (mode === "recycle") {
    // Always re-enter from the left so the stream never thins out
    positions[i3] = -FIELD_SPREAD_X * (0.95 + Math.random() * 0.55);
  } else {
    positions[i3] = (Math.random() - 0.5) * FIELD_SPREAD_X * 2;
  }

  positions[i3 + 1] = (Math.random() - 0.5) * FIELD_SPREAD_Y * 2;
  positions[i3 + 2] = -8 - depthT * FIELD_DEPTH;

  // Farther stars a bit brighter so depth stays readable
  const farness = depthT;
  const shade = 0.52 + farness * 0.48 + Math.random() * 0.08;
  const cool = Math.random() > 0.9;
  colors[i3] = cool ? shade * 0.88 : shade;
  colors[i3 + 1] = cool ? shade * 0.92 : shade;
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
    scene.fog = new THREE.FogExp2(0x030305, 0.0055);

    const camera = new THREE.PerspectiveCamera(
      62,
      Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1),
      0.1,
      320
    );
    camera.position.set(0, 0, 0);

    const isMobile = window.innerWidth < 768;
    const starCount = getStarCount();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.setSize(
      Math.max(mount.clientWidth, 1),
      Math.max(mount.clientHeight, 1)
    );
    renderer.setClearColor(0x030305, 1);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    mount.appendChild(renderer.domElement);

    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      placeStar(positions, colors, i, "full");
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: isMobile ? 0.16 : 0.13,
      map: createStarTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      opacity: 1,
      sizeAttenuation: true,
    });

    const stars = new THREE.Points(geometry, material);
    scene.add(stars);

    const resize = () => {
      const w = Math.max(mount.clientWidth, window.innerWidth, 1);
      const h = Math.max(mount.clientHeight, window.innerHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2)
      );
      renderer.setSize(w, h);
    };

    const positionAttr = geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;
    const edgeX = FIELD_SPREAD_X * 1.25;

    const tick = () => {
      if (disposed) {
        return;
      }
      frame = window.requestAnimationFrame(tick);

      if (!activeRef.current) {
        return;
      }

      const arr = positionAttr.array as Float32Array;
      let recycled = false;

      for (let i = 0; i < starCount; i += 1) {
        const i3 = i * 3;
        const depth = Math.abs(arr[i3 + 2]);
        const nearness = 1 - Math.min(1, depth / FIELD_DEPTH);
        const speedScale = 0.35 + nearness * 1.35;

        arr[i3] += DRIFT_RIGHT * speedScale;
        arr[i3 + 2] += DRIFT_TOWARD * speedScale;

        const offRight = arr[i3] > edgeX;
        const passedCamera = arr[i3 + 2] > 1.5;
        if (offRight || passedCamera) {
          placeStar(arr, colors, i, "recycle");
          recycled = true;
        }
      }

      positionAttr.needsUpdate = true;
      if (recycled) {
        colorAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    resize();
    const layoutPass = window.requestAnimationFrame(resize);
    frame = window.requestAnimationFrame(tick);
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(layoutPass);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    const mount = mountRef.current;
    if (!mount?.querySelector("canvas")) {
      return;
    }
    window.dispatchEvent(new Event("resize"));
  }, [active]);

  return (
    <div
      ref={mountRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
