"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const STAR_COUNT_DESKTOP = 4200;
const STAR_COUNT_MOBILE = 1800;
const FIELD_DEPTH = 220;
const FIELD_SPREAD_X = 70;
const FIELD_SPREAD_Y = 42;
const DRIFT_SPEED = 0.022;

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
  mode: "full" | "left" = "full"
) {
  const i3 = index * 3;
  // Bias toward deeper space so the field feels thick
  const depthT = Math.pow(Math.random(), 0.55);
  positions[i3] =
    mode === "left"
      ? -FIELD_SPREAD_X * (0.85 + Math.random() * 0.35)
      : (Math.random() - 0.5) * FIELD_SPREAD_X * 2;
  positions[i3 + 1] = (Math.random() - 0.5) * FIELD_SPREAD_Y * 2;
  positions[i3 + 2] = -4 - depthT * FIELD_DEPTH;

  // Dimmer far stars, slightly brighter near ones
  const nearness = 1 - depthT;
  const shade = 0.35 + nearness * 0.45 + Math.random() * 0.15;
  const cool = Math.random() > 0.9;
  colors[i3] = cool ? shade * 0.78 : shade;
  colors[i3 + 1] = cool ? shade * 0.84 : shade;
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
    scene.fog = new THREE.FogExp2(0x020203, 0.016);

    const camera = new THREE.PerspectiveCamera(
      58,
      Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1),
      0.1,
      280
    );
    camera.position.set(0, 0, 0);

    const isMobile = window.innerWidth < 768;
    const starCount = getStarCount();
    const dustCount = isMobile ? 80 : 160;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x020203, 1);
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
      size: isMobile ? 0.095 : 0.08,
      map: createStarTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexColors: true,
      opacity: 0.78,
      sizeAttenuation: true,
    });

    const stars = new THREE.Points(geometry, material);
    scene.add(stars);

    const dustPos = new Float32Array(dustCount * 3);
    const dustCol = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i += 1) {
      const i3 = i * 3;
      const arm = i % 3;
      const t = Math.random();
      const radius = 4 + t * 14;
      const angle =
        arm * ((Math.PI * 2) / 3) + t * 3.1 + (Math.random() - 0.5) * 0.4;
      dustPos[i3] = Math.cos(angle) * radius * 1.2 + 8;
      dustPos[i3 + 1] = Math.sin(angle) * radius * 0.45 - 2;
      dustPos[i3 + 2] = -90 - Math.random() * 80;
      const tone = 0.12 + Math.random() * 0.12;
      dustCol[i3] = tone * 0.65;
      dustCol[i3 + 1] = tone * 0.75;
      dustCol[i3 + 2] = tone;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute("color", new THREE.BufferAttribute(dustCol, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.1,
      map: createStarTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexColors: true,
      opacity: 0.14,
      sizeAttenuation: true,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    const resize = () => {
      const w = Math.max(mount.clientWidth, 1);
      const h = Math.max(mount.clientHeight, 1);
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
    const edgeX = FIELD_SPREAD_X * 1.15;

    const tick = () => {
      if (disposed) {
        return;
      }
      frame = window.requestAnimationFrame(tick);

      if (!activeRef.current) {
        return;
      }

      const arr = positionAttr.array as Float32Array;
      for (let i = 0; i < starCount; i += 1) {
        const i3 = i * 3;
        // Near stars drift right faster — reads as depth parallax
        const depth = Math.abs(arr[i3 + 2]);
        const nearness = 1 - Math.min(1, depth / FIELD_DEPTH);
        const speed = DRIFT_SPEED * (0.35 + nearness * 1.15);
        arr[i3] += speed;

        if (arr[i3] > edgeX) {
          placeStar(arr, colors, i, "left");
          colorAttr.needsUpdate = true;
        }
      }
      positionAttr.needsUpdate = true;

      dust.position.x += DRIFT_SPEED * 0.12;
      if (dust.position.x > 8) {
        dust.position.x = -8;
      }
      dust.rotation.z += 0.00005;

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
