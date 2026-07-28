"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { portfolioOwner } from "@/content/portfolio";

type SplashIntroProps = {
  onComplete: () => void;
};

const PARTICLE_COUNT = 3200;

function setSpherePositions(target: Float32Array, radius: number) {
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.82 + Math.random() * 0.28);
    const i3 = i * 3;
    target[i3] = r * Math.sin(phi) * Math.cos(theta);
    target[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    target[i3 + 2] = r * Math.cos(phi);
  }
}

function setCloudPositions(target: Float32Array, spread: number) {
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const i3 = i * 3;
    target[i3] = (Math.random() - 0.5) * spread;
    target[i3 + 1] = (Math.random() - 0.5) * spread;
    target[i3 + 2] = (Math.random() - 0.5) * spread;
  }
}

function setRingPositions(target: Float32Array, radius: number) {
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
    const wobble = (Math.random() - 0.5) * 0.55;
    const r = radius + (Math.random() - 0.5) * 0.8;
    const i3 = i * 3;
    target[i3] = Math.cos(angle) * r;
    target[i3 + 1] = wobble;
    target[i3 + 2] = Math.sin(angle) * r;
  }
}

function createParticleTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.Texture();
  }

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function paintVignette(canvas: HTMLCanvasElement) {
  const width = Math.max(1, Math.round(window.innerWidth));
  const height = Math.max(1, Math.round(window.innerHeight));
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const cx = width * 0.5;
  const cy = height * 0.48;
  const radius = Math.max(width, height) * 0.78;
  const gradient = ctx.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius);

  // Many soft stops + slight noise later to kill banding
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.22, "rgba(0,0,0,0.04)");
  gradient.addColorStop(0.4, "rgba(0,0,0,0.14)");
  gradient.addColorStop(0.55, "rgba(0,0,0,0.3)");
  gradient.addColorStop(0.7, "rgba(0,0,0,0.52)");
  gradient.addColorStop(0.84, "rgba(0,0,0,0.72)");
  gradient.addColorStop(1, "rgba(0,0,0,0.9)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Tiny dither noise breaks visible contour lines
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 16) {
    const n = (Math.random() - 0.5) * 8;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);
}

export function SplashIntro({ onComplete }: SplashIntroProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const vignetteRef = useRef<HTMLCanvasElement | null>(null);
  const counterRef = useRef<HTMLSpanElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const root = rootRef.current;
    const mount = mountRef.current;
    const vignetteCanvas = vignetteRef.current;
    const counter = counterRef.current;
    const progress = progressRef.current;
    if (!root || !mount || !vignetteCanvas || !counter || !progress) {
      return;
    }

    const finish = () => {
      if (completedRef.current) {
        return;
      }
      completedRef.current = true;
      onCompleteRef.current();
    };

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) {
      gsap.set(root, { autoAlpha: 0 });
      finish();
      return;
    }

    let animationFrame = 0;
    let disposed = false;

    paintVignette(vignetteCanvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1),
      0.1,
      100
    );
    camera.position.set(0, 0, 9.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    mount.appendChild(renderer.domElement);

    const cloud = new Float32Array(PARTICLE_COUNT * 3);
    const sphere = new Float32Array(PARTICLE_COUNT * 3);
    const ring = new Float32Array(PARTICLE_COUNT * 3);
    const current = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);

    setCloudPositions(cloud, 18);
    setSpherePositions(sphere, 2.35);
    setRingPositions(ring, 3.1);
    current.set(cloud);

    // No bright white — keeps the name readable over the particle field
    const palette = [
      new THREE.Color("#df5f38"),
      new THREE.Color("#8a79ff"),
      new THREE.Color("#39d0c1"),
      new THREE.Color("#c4b5fd"),
    ];

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const color = palette[i % palette.length].clone();
      color.multiplyScalar(0.75 + Math.random() * 0.45);
      const i3 = i * 3;
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(current, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.055,
      map: createParticleTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      opacity: 0,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const state = {
      morph: 0,
      explode: 0,
      cameraZ: 9.5,
      spin: 0.35,
      particleSize: 0.055,
    };

    const mixPositions = () => {
      const morph = state.morph;
      const explode = state.explode;
      const positions = geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const i3 = i * 3;
        const fromX = cloud[i3];
        const fromY = cloud[i3 + 1];
        const fromZ = cloud[i3 + 2];

        const midX = THREE.MathUtils.lerp(sphere[i3], ring[i3], Math.max(0, morph - 1));
        const midY = THREE.MathUtils.lerp(
          sphere[i3 + 1],
          ring[i3 + 1],
          Math.max(0, morph - 1)
        );
        const midZ = THREE.MathUtils.lerp(
          sphere[i3 + 2],
          ring[i3 + 2],
          Math.max(0, morph - 1)
        );

        const formedX = THREE.MathUtils.lerp(fromX, midX, Math.min(1, morph));
        const formedY = THREE.MathUtils.lerp(fromY, midY, Math.min(1, morph));
        const formedZ = THREE.MathUtils.lerp(fromZ, midZ, Math.min(1, morph));

        const burst = 1 + explode * (2.8 + (i % 17) * 0.05);
        positions[i3] = formedX * burst;
        positions[i3 + 1] = formedY * burst;
        positions[i3 + 2] = formedZ * burst;
      }

      geometry.attributes.position.needsUpdate = true;
    };

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      paintVignette(vignetteCanvas);
    };

    const tick = () => {
      if (disposed) {
        return;
      }

      animationFrame = window.requestAnimationFrame(tick);
      points.rotation.y += 0.0028 * state.spin;
      points.rotation.x += 0.0009 * state.spin;
      camera.position.z = state.cameraZ;
      material.size = state.particleSize;
      mixPositions();
      renderer.render(scene, camera);
    };

    const kicker = root.querySelector("[data-splash-kicker]");
    const nameLines = root.querySelectorAll("[data-splash-name]");
    const role = root.querySelector("[data-splash-role]");
    const meter = root.querySelector("[data-splash-meter]");
    const center = root.querySelector("[data-splash-center]");
    const vignette = vignetteCanvas;

    const counterState = { value: 0 };

    gsap.set([kicker, role, meter], { autoAlpha: 0, y: 20 });
    gsap.set(nameLines, { yPercent: 115 });
    gsap.set(progress, { scaleX: 0, transformOrigin: "left center" });
    gsap.set(vignette, { autoAlpha: 0 });
    gsap.set(material, { opacity: 0 });

    const timeline = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: finish,
    });

    timeline
      .to(vignette, { autoAlpha: 1, duration: 0.55 }, 0)
      .to(material, { opacity: 1, duration: 0.85 }, 0.05)
      .to(
        state,
        {
          morph: 1,
          duration: 1.55,
          ease: "power2.inOut",
        },
        0.15
      )
      .to(kicker, { autoAlpha: 1, y: 0, duration: 0.65 }, 0.7)
      .to(
        nameLines,
        {
          yPercent: 0,
          duration: 1.05,
          stagger: 0.12,
          ease: "power4.out",
        },
        0.85
      )
      .to(role, { autoAlpha: 1, y: 0, duration: 0.6 }, 1.2)
      .to(meter, { autoAlpha: 1, y: 0, duration: 0.55 }, 1.35)
      .to(
        counterState,
        {
          value: 100,
          duration: 1.65,
          ease: "power2.inOut",
          onUpdate: () => {
            counter.textContent = String(Math.round(counterState.value)).padStart(
              3,
              "0"
            );
          },
        },
        1.4
      )
      .to(
        progress,
        {
          scaleX: 1,
          duration: 1.65,
          ease: "power2.inOut",
        },
        1.4
      )
      .to(
        state,
        {
          morph: 2,
          duration: 1.1,
          ease: "power2.inOut",
        },
        2.2
      )
      .to(
        state,
        {
          spin: 1.35,
          particleSize: 0.072,
          duration: 1.1,
          ease: "power2.inOut",
        },
        2.2
      )
      .to(
        center,
        {
          autoAlpha: 0,
          y: -20,
          filter: "blur(8px)",
          duration: 0.5,
          ease: "power2.in",
        },
        3.35
      )
      .to(
        state,
        {
          explode: 1,
          cameraZ: 4.4,
          particleSize: 0.034,
          spin: 2.1,
          duration: 1.1,
          ease: "power3.in",
        },
        3.4
      )
      .to(material, { opacity: 0, duration: 0.75, ease: "power2.in" }, 3.7)
      .to(vignette, { autoAlpha: 0, duration: 0.7, ease: "power2.inOut" }, 3.85)
      .to(
        root,
        {
          autoAlpha: 0,
          duration: 0.65,
          ease: "power2.inOut",
        },
        4.05
      );

    tick();
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      timeline.kill();
      window.cancelAnimationFrame(animationFrame);
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

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] overflow-hidden bg-black text-white"
      aria-hidden
    >
      <div ref={mountRef} className="absolute inset-0 z-[1]" />

      <canvas
        ref={vignetteRef}
        data-splash-vignette
        className="pointer-events-none absolute inset-0 z-[2] h-full w-full opacity-0"
      />

      <div
        data-splash-center
        className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[22rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 blur-3xl md:h-[26rem] md:w-[42rem]" />

        <div className="relative text-center">
          <p
            data-splash-kicker
            className="text-[10px] uppercase tracking-[0.48em] text-white/55"
          >
            {portfolioOwner.location}
          </p>

          <div className="mt-7">
            <div className="overflow-hidden">
              <h1
                data-splash-name
                className="text-5xl font-semibold tracking-tight text-white drop-shadow-[0_8px_40px_rgba(0,0,0,0.85)] md:text-7xl lg:text-8xl"
              >
                {portfolioOwner.firstName}
              </h1>
            </div>
            <div className="overflow-hidden">
              <h1
                data-splash-name
                className="text-5xl font-semibold tracking-tight text-white/90 drop-shadow-[0_8px_40px_rgba(0,0,0,0.85)] md:text-7xl lg:text-8xl"
              >
                {portfolioOwner.lastName}
              </h1>
            </div>
          </div>

          <p
            data-splash-role
            className="mt-6 text-[11px] uppercase tracking-[0.38em] text-white/60"
          >
            {portfolioOwner.headline}
          </p>

          <div
            data-splash-meter
            className="mx-auto mt-14 flex w-full max-w-[220px] flex-col items-center gap-3"
          >
            <div className="flex w-full items-baseline justify-between text-[10px] uppercase tracking-[0.34em] text-white/45">
              <span>Loading</span>
              <span ref={counterRef}>000</span>
            </div>
            <div className="h-px w-full overflow-hidden bg-white/12">
              <div ref={progressRef} className="h-full w-full bg-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
