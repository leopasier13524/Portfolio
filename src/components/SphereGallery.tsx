"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import type { PortfolioProject } from "@/content/portfolio";
import { FISHEYE_STRENGTH, FISHEYE_ZOOM, ndcToDisplayScreen } from "@/lib/fisheye";

type SphereGalleryProps = {
  projects: PortfolioProject[];
  activeProjectSlug: string | null;
  active?: boolean;
  onSelectProject: (
    project: PortfolioProject,
    rect: { left: number; top: number; width: number; height: number },
    previewSrc: string
  ) => void;
};

type OrbDefinition = {
  baseX: number;
  baseY: number;
  radius: number;
  alpha: number;
  speedX: number;
  speedY: number;
  phaseX: number;
  phaseY: number;
  ampX: number;
  ampY: number;
};

type OrbHighlightState = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  orbs: OrbDefinition[];
  active: boolean;
};

type CardMesh = THREE.Mesh<
  THREE.PlaneGeometry,
  THREE.MeshBasicMaterial
> & {
  userData: {
    project: PortfolioProject;
    col: number;
    row: number;
    orbMaterial: THREE.MeshBasicMaterial;
    backgroundMaterial: THREE.MeshBasicMaterial;
    orbHighlight: OrbHighlightState;
    highlightEdgeMaterial: THREE.LineBasicMaterial;
  };
};

const CARD_WIDTH = 3.6;
const CARD_HEIGHT = 2.55;
const TILE_W = CARD_WIDTH;
const TILE_H = CARD_HEIGHT;
const RENDER_COLS = 9;
const RENDER_ROWS = 7;
const PAN_SCALE = 0.0095;
const SMOOTH = 0.085;
const VIEW_ZOOM_OUT_SMOOTH = 0.08;
const VIEW_ZOOM_IN_SMOOTH = 0.14;
const IDLE_FISHEYE_STRENGTH = 0.32;
const DRAG_FISHEYE_STRENGTH = 0.28;
const IDLE_FISHEYE_ZOOM = 0.96;
const DRAG_FISHEYE_ZOOM = 0.96;
const IDLE_CAMERA_Z = 10.2;
const DRAG_CAMERA_Z = 13.2;
const CARD_BORDER_OPACITY = 0.22;
const CARD_BORDER_HOVER_OPACITY = 0.72;
const ORB_CANVAS_SIZE = 512;
const ORB_OVERLAY_OPACITY = 0.52;
const HOVER_BACKGROUND_OPACITY = 0.24;

function createOrbHighlightState(): OrbHighlightState {
  const canvas = document.createElement("canvas");
  canvas.width = ORB_CANVAS_SIZE;
  canvas.height = ORB_CANVAS_SIZE;
  const ctx = canvas.getContext("2d")!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const orbs: OrbDefinition[] = [
    {
      baseX: 0.34,
      baseY: 0.4,
      radius: 0.48,
      alpha: 0.48,
      speedX: 0.62,
      speedY: 0.54,
      phaseX: 0,
      phaseY: 1.4,
      ampX: 0.24,
      ampY: 0.2,
    },
    {
      baseX: 0.66,
      baseY: 0.58,
      radius: 0.42,
      alpha: 0.4,
      speedX: 0.48,
      speedY: 0.7,
      phaseX: 2.2,
      phaseY: 0.6,
      ampX: 0.22,
      ampY: 0.24,
    },
    {
      baseX: 0.52,
      baseY: 0.24,
      radius: 0.34,
      alpha: 0.34,
      speedX: 0.78,
      speedY: 0.42,
      phaseX: 4.4,
      phaseY: 3.1,
      ampX: 0.28,
      ampY: 0.18,
    },
    {
      baseX: 0.22,
      baseY: 0.72,
      radius: 0.3,
      alpha: 0.28,
      speedX: 0.56,
      speedY: 0.66,
      phaseX: 1.1,
      phaseY: 4.8,
      ampX: 0.18,
      ampY: 0.16,
    },
  ];

  return { canvas, ctx, texture, orbs, active: false };
}

function clearOrbHighlight(state: OrbHighlightState) {
  state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  state.texture.needsUpdate = true;
}

function drawOrbHighlight(state: OrbHighlightState, accent: THREE.Color) {
  const { canvas, ctx, orbs } = state;
  const width = canvas.width;
  const height = canvas.height;
  const time = performance.now() * 0.001;
  // Lift accents toward white so orbs stay visible on dark screenshots.
  const lift = 0.22;
  const red = Math.round((accent.r * (1 - lift) + lift) * 255);
  const green = Math.round((accent.g * (1 - lift) + lift) * 255);
  const blue = Math.round((accent.b * (1 - lift) + lift) * 255);

  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter";

  for (const orb of orbs) {
    const x =
      (orb.baseX + Math.sin(time * orb.speedX + orb.phaseX) * orb.ampX) *
      width;
    const y =
      (orb.baseY + Math.cos(time * orb.speedY + orb.phaseY) * orb.ampY) *
      height;
    const radius = orb.radius * Math.min(width, height);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${orb.alpha})`);
    gradient.addColorStop(
      0.35,
      `rgba(${red}, ${green}, ${blue}, ${orb.alpha * 0.55})`
    );
    gradient.addColorStop(
      0.7,
      `rgba(${red}, ${green}, ${blue}, ${orb.alpha * 0.18})`
    );
    gradient.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
  state.texture.needsUpdate = true;
}

const FISHEYE_FRAGMENT = `
  uniform sampler2D tDiffuse;
  uniform float strength;
  uniform float zoom;
  varying vec2 vUv;

  void main() {
    // Center-magnifying barrel (fisheye): sample closer to center at the edges
    // so the middle looks zoomed in. The old (1 + strength * r2) formula did
    // the opposite and sampled past the texture edges, causing the stretched
    // side streaks.
    vec2 uv = vUv - 0.5;
    float r2 = dot(uv, uv);
    uv *= zoom * (1.0 - strength * r2);
    uv += 0.5;
    uv = clamp(uv, 0.001, 0.999);
    gl_FragColor = texture2D(tDiffuse, uv);
  }
`;

const FISHEYE_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function clearMount(node: HTMLDivElement) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

const CARD_TEXTURE_WIDTH = 720;
const CARD_TEXTURE_HEIGHT = 510;
const CARD_IMAGE_RATIO = 390 / CARD_TEXTURE_HEIGHT;
const MAX_RENDER_PIXEL_RATIO = 2;
const MAX_CARD_TEXTURE_WIDTH = 2400;

function getRendererPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, MAX_RENDER_PIXEL_RATIO);
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const source = image as HTMLImageElement;
  const sw = source.width ?? w;
  const sh = source.height ?? h;
  const sourceAspect = sw / sh;
  const destAspect = w / h;

  let sx = 0;
  let sy = 0;
  let sWidth = sw;
  let sHeight = sh;

  if (sourceAspect > destAspect) {
    sWidth = sh * destAspect;
    sx = (sw - sWidth) / 2;
  } else {
    sHeight = sw / destAspect;
    sy = (sh - sHeight) / 2;
  }

  ctx.drawImage(image, sx, sy, sWidth, sHeight, x, y, w, h);
}

function createCardTexture(
  project: PortfolioProject,
  image: HTMLImageElement,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  const sourceWidth = image.naturalWidth || CARD_TEXTURE_WIDTH;
  const canvasWidth = Math.min(
    Math.max(sourceWidth, CARD_TEXTURE_WIDTH * 2),
    MAX_CARD_TEXTURE_WIDTH
  );
  const canvasHeight = Math.round(canvasWidth * (CARD_TEXTURE_HEIGHT / CARD_TEXTURE_WIDTH));
  const imageHeight = Math.round(canvasHeight * CARD_IMAGE_RATIO);
  const layoutScale = canvasWidth / CARD_TEXTURE_WIDTH;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#080808";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  drawCoverImage(ctx, image, 0, 0, canvasWidth, imageHeight);

  ctx.fillStyle = "#080808";
  ctx.fillRect(0, imageHeight, canvasWidth, canvasHeight - imageHeight);

  const footerHeight = canvasHeight - imageHeight;
  const titleY = imageHeight + footerHeight * 0.36;
  const labelY = imageHeight + footerHeight * 0.72;
  const paddingX = Math.round(28 * layoutScale);

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${Math.round(36 * layoutScale)}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(project.title, paddingX, titleY);

  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.font = `600 ${Math.round(24 * layoutScale)}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
  const yearWidth = ctx.measureText(project.year).width;
  ctx.fillText(
    project.year,
    canvasWidth - paddingX - yearWidth,
    titleY
  );

  ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
  ctx.font = `500 ${Math.round(20 * layoutScale)}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
  ctx.fillText(project.cardLabel, paddingX, labelY);

  const borderWidth = Math.max(2, Math.round(2 * layoutScale));
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(
    borderWidth / 2,
    borderWidth / 2,
    canvasWidth - borderWidth,
    canvasHeight - borderWidth
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = Math.min(8, maxAnisotropy);
  texture.needsUpdate = true;
  return texture;
}

function findCardMesh(object: THREE.Object3D | null): CardMesh | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current instanceof THREE.Mesh && "project" in current.userData) {
      return current as CardMesh;
    }
    current = current.parent;
  }
  return null;
}

export function SphereGallery({
  projects,
  activeProjectSlug,
  active = true,
  onSelectProject,
}: SphereGalleryProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const projectSelectRef = useRef(onSelectProject);
  const activeSlugRef = useRef(activeProjectSlug);
  const galleryActiveRef = useRef(active);
  const animationFrameRef = useRef(0);
  const tickRef = useRef<(() => void) | null>(null);
  const flushTexturesRef = useRef<(() => void) | null>(null);
  const resetFocusRef = useRef<(() => void) | null>(null);
  const sessionRef = useRef(0);

  useEffect(() => {
    projectSelectRef.current = onSelectProject;
  }, [onSelectProject]);

  useEffect(() => {
    activeSlugRef.current = activeProjectSlug;
  }, [activeProjectSlug]);

  useEffect(() => {
    galleryActiveRef.current = active;
  }, [active]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || projects.length === 0) {
      return;
    }

    const session = ++sessionRef.current;
    clearMount(mount);

    let animationFrame = 0;
    let ready = false;

    const materials: THREE.Material[] = [];
    const cardTextures: THREE.CanvasTexture[] = [];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050505");

    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1),
      0.1,
      100
    );
    camera.position.set(0, 0, 10.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    const pixelRatio = getRendererPixelRatio();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    mount.appendChild(renderer.domElement);

    const renderTarget = new THREE.WebGLRenderTarget(
      Math.round(mount.clientWidth * pixelRatio),
      Math.round(mount.clientHeight * pixelRatio),
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
        colorSpace: THREE.SRGBColorSpace,
      }
    );

    const fisheyeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: renderTarget.texture },
        strength: { value: FISHEYE_STRENGTH },
        zoom: { value: FISHEYE_ZOOM },
      },
      vertexShader: FISHEYE_VERTEX,
      fragmentShader: FISHEYE_FRAGMENT,
    });
    materials.push(fisheyeMaterial);

    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fisheyeMaterial);
    postScene.add(postQuad);

    const cardGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
    const highlightGeometry = new THREE.EdgesGeometry(cardGeometry);
    const wallGroup = new THREE.Group();
    scene.add(wallGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickTargets: CardMesh[] = [];

    let pointerDown = false;
    let moved = false;
    let pressX = 0;
    let pressY = 0;
    let targetPanX = 0;
    let targetPanY = 0;
    let currentPanX = 0;
    let currentPanY = 0;
    let velocityPanX = 0;
    let velocityPanY = 0;
    let targetViewZoom = 0;
    let currentViewZoom = 0;
    let hovered: CardMesh | null = null;
    let focused: CardMesh | null = null;

    const cardMeshes: CardMesh[] = [];
    const cardCount = RENDER_COLS * RENDER_ROWS;
    const halfCols = Math.floor(RENDER_COLS / 2);
    const halfRows = Math.floor(RENDER_ROWS / 2);

    const placeholderTexture = new THREE.CanvasTexture(
      document.createElement("canvas")
    );
    placeholderTexture.colorSpace = THREE.SRGBColorSpace;

    const updateWallLayout = () => {
      if (!ready) {
        return;
      }

      const wrappedX = mod(currentPanX, TILE_W);
      const wrappedY = mod(currentPanY, TILE_H);
      const stepX = Math.floor(currentPanX / TILE_W);
      const stepY = Math.floor(currentPanY / TILE_H);

      for (const mesh of cardMeshes) {
        const col = mesh.userData.col;
        const row = mesh.userData.row;
        const colOffset = col - halfCols;
        const rowOffset = row - halfRows;

        mesh.position.set(
          colOffset * TILE_W - wrappedX,
          -rowOffset * TILE_H + wrappedY,
          0
        );
        mesh.rotation.set(0, 0, 0);

        const globalCol = stepX + colOffset;
        const globalRow = stepY + rowOffset;
        const projIdx = mod(globalCol + globalRow * 7, projects.length);
        const project = projects[projIdx];

        if (mesh.userData.project.slug !== project.slug) {
          mesh.userData.project = project;
          mesh.material.map = cardTextures[projIdx] ?? placeholderTexture;
          mesh.material.needsUpdate = true;
        }
      }
    };

    const snapCardHighlightOff = (card: CardMesh) => {
      const {
        orbMaterial,
        backgroundMaterial,
        orbHighlight,
        highlightEdgeMaterial,
      } = card.userData;

      gsap.killTweensOf(orbMaterial);
      gsap.killTweensOf(backgroundMaterial);
      gsap.killTweensOf(highlightEdgeMaterial);
      gsap.killTweensOf(highlightEdgeMaterial.color);

      orbHighlight.active = false;
      clearOrbHighlight(orbHighlight);
      orbMaterial.opacity = 0;
      backgroundMaterial.opacity = 0;
      highlightEdgeMaterial.opacity = CARD_BORDER_OPACITY;
      highlightEdgeMaterial.color.set(0xffffff);
    };

    const deactivateCardHighlight = (card: CardMesh) => {
      const {
        orbMaterial,
        backgroundMaterial,
        orbHighlight,
        highlightEdgeMaterial,
      } = card.userData;

      gsap.killTweensOf(orbMaterial);
      gsap.killTweensOf(backgroundMaterial);
      gsap.killTweensOf(highlightEdgeMaterial);
      gsap.killTweensOf(highlightEdgeMaterial.color);

      orbHighlight.active = false;

      gsap.to(orbMaterial, {
        opacity: 0,
        duration: 0.35,
        ease: "power2.inOut",
        onComplete: () => {
          clearOrbHighlight(orbHighlight);
        },
      });
      gsap.to(backgroundMaterial, {
        opacity: 0,
        duration: 0.35,
        ease: "power2.inOut",
      });
      gsap.to(highlightEdgeMaterial, {
        opacity: CARD_BORDER_OPACITY,
        duration: 0.35,
        ease: "power2.inOut",
      });
      gsap.to(highlightEdgeMaterial.color, {
        r: 1,
        g: 1,
        b: 1,
        duration: 0.35,
        ease: "power2.inOut",
      });
    };

    const activateCardHighlight = (card: CardMesh) => {
      const {
        orbMaterial,
        backgroundMaterial,
        orbHighlight,
        highlightEdgeMaterial,
        project,
      } = card.userData;
      const accent = new THREE.Color(project.accent);
      const softAccent = accent.clone().lerp(new THREE.Color(0xffffff), 0.45);

      gsap.killTweensOf(orbMaterial);
      gsap.killTweensOf(backgroundMaterial);
      gsap.killTweensOf(highlightEdgeMaterial);
      gsap.killTweensOf(highlightEdgeMaterial.color);

      orbHighlight.active = true;
      orbMaterial.opacity = 0;
      backgroundMaterial.opacity = 0;
      backgroundMaterial.color.copy(accent);
      drawOrbHighlight(orbHighlight, accent);

      gsap.to(backgroundMaterial, {
        opacity: HOVER_BACKGROUND_OPACITY,
        duration: 0.45,
        ease: "power2.out",
      });
      gsap.to(orbMaterial, {
        opacity: ORB_OVERLAY_OPACITY,
        duration: 0.45,
        ease: "power2.out",
      });

      gsap.to(highlightEdgeMaterial, {
        opacity: CARD_BORDER_HOVER_OPACITY,
        duration: 0.55,
        ease: "power2.out",
        onComplete: () => {
          if (hovered !== card) {
            return;
          }

          gsap.to(highlightEdgeMaterial, {
            opacity: 0.48,
            duration: 1.5,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
          });
        },
      });
      gsap.to(highlightEdgeMaterial.color, {
        r: softAccent.r,
        g: softAccent.g,
        b: softAccent.b,
        duration: 0.55,
        ease: "power2.out",
      });
    };

    const highlight = (card: CardMesh | null) => {
      if (focused && card) {
        return;
      }

      if (hovered === card) {
        return;
      }

      if (hovered) {
        deactivateCardHighlight(hovered);
      }

      hovered = card;

      if (hovered) {
        activateCardHighlight(hovered);
      }
    };

    const getCardScreenRect = (card: CardMesh) => {
      const canvasRect = renderer.domElement.getBoundingClientRect();
      const halfW = CARD_WIDTH / 2;
      const halfH = CARD_HEIGHT / 2;
      const corners = [
        new THREE.Vector3(-halfW, halfH, 0),
        new THREE.Vector3(halfW, halfH, 0),
        new THREE.Vector3(-halfW, -halfH, 0),
        new THREE.Vector3(halfW, -halfH, 0),
      ].map((corner) => {
        const world = corner.clone();
        card.localToWorld(world);
        world.project(camera);
        return ndcToDisplayScreen(world.x, world.y, canvasRect);
      });

      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      const left = Math.min(...xs);
      const right = Math.max(...xs);
      const top = Math.min(...ys);
      const bottom = Math.max(...ys);

      return {
        left,
        top,
        width: Math.max(right - left, 1),
        height: Math.max(bottom - top, 1),
      };
    };

    const getCardPreview = (card: CardMesh) => {
      const map = card.material.map;
      if (map instanceof THREE.CanvasTexture && map.image instanceof HTMLCanvasElement) {
        return map.image.toDataURL("image/png");
      }
      return card.userData.project.heroImage;
    };

    const focusCard = (card: CardMesh) => {
      if (focused || activeSlugRef.current) {
        return;
      }

      focused = card;

      if (hovered) {
        snapCardHighlightOff(hovered);
        hovered = null;
      }

      const rect = getCardScreenRect(card);
      const previewSrc = getCardPreview(card);

      projectSelectRef.current(card.userData.project, rect, previewSrc);
    };

    const resetFocus = () => {
      focused = null;
      for (const mesh of cardMeshes) {
        gsap.killTweensOf(mesh.position);
        gsap.killTweensOf(mesh.material);
        snapCardHighlightOff(mesh);
        mesh.position.z = 0;
        gsap.to(mesh.material, { opacity: 1, duration: 0.35 });
      }
    };
    resetFocusRef.current = resetFocus;

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!ready || !galleryActiveRef.current || activeSlugRef.current) {
        return;
      }
      pointerDown = true;
      moved = false;
      pressX = event.clientX;
      pressY = event.clientY;
      velocityPanX = 0;
      velocityPanY = 0;
      targetViewZoom = 1;
      highlight(null);
      mount.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!ready || !galleryActiveRef.current) {
        return;
      }

      updatePointer(event.clientX, event.clientY);

      if (pointerDown) {
        if (activeSlugRef.current) {
          return;
        }

        const dx = event.clientX - pressX;
        const dy = event.clientY - pressY;

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          moved = true;
          highlight(null);
        }

        targetPanX -= dx * PAN_SCALE;
        targetPanY -= dy * PAN_SCALE;
        velocityPanX = -dx * PAN_SCALE;
        velocityPanY = -dy * PAN_SCALE;

        pressX = event.clientX;
        pressY = event.clientY;
        return;
      }

      if (!focused) {
        raycaster.setFromCamera(pointer, camera);
        const [hit] = raycaster.intersectObjects(pickTargets, false);
        highlight(findCardMesh(hit?.object ?? null));
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerDown) {
        mount.releasePointerCapture(event.pointerId);
      }

      const wasMoved = moved;
      pointerDown = false;

      if (!ready || !galleryActiveRef.current || activeSlugRef.current) {
        return;
      }

      if (wasMoved) {
        highlight(null);
        return;
      }

      updatePointer(event.clientX, event.clientY);
      raycaster.setFromCamera(pointer, camera);
      const [hit] = raycaster.intersectObjects(pickTargets, false);
      const card = findCardMesh(hit?.object ?? null);
      if (card) {
        focusCard(card);
      }
    };

    const onPointerLeave = () => {
      if (!pointerDown) {
        highlight(null);
      }
    };

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      const nextPixelRatio = getRendererPixelRatio();
      renderer.setPixelRatio(nextPixelRatio);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderTarget.setSize(
        Math.round(width * nextPixelRatio),
        Math.round(height * nextPixelRatio)
      );
    };

    const tick = () => {
      if (session !== sessionRef.current) {
        return;
      }

      animationFrame = window.requestAnimationFrame(tick);
      animationFrameRef.current = animationFrame;

      const interactive = galleryActiveRef.current;

      if (!interactive) {
        idleRenderFrame += 1;
        if (idleRenderFrame % 3 !== 0) {
          return;
        }
      } else {
        idleRenderFrame = 0;
      }

      if (interactive && ready && !pointerDown && !activeSlugRef.current && !focused) {
        targetPanX += velocityPanX;
        targetPanY += velocityPanY;
        velocityPanX *= 0.9;
        velocityPanY *= 0.9;
      }

      currentPanX = THREE.MathUtils.lerp(currentPanX, targetPanX, SMOOTH);
      currentPanY = THREE.MathUtils.lerp(currentPanY, targetPanY, SMOOTH);

      targetViewZoom = interactive && pointerDown ? 1 : 0;
      currentViewZoom = THREE.MathUtils.lerp(
        currentViewZoom,
        targetViewZoom,
        pointerDown ? VIEW_ZOOM_OUT_SMOOTH : VIEW_ZOOM_IN_SMOOTH
      );

      fisheyeMaterial.uniforms.strength.value = THREE.MathUtils.lerp(
        IDLE_FISHEYE_STRENGTH,
        DRAG_FISHEYE_STRENGTH,
        currentViewZoom
      );
      fisheyeMaterial.uniforms.zoom.value = THREE.MathUtils.lerp(
        IDLE_FISHEYE_ZOOM,
        DRAG_FISHEYE_ZOOM,
        currentViewZoom
      );
      camera.position.z = THREE.MathUtils.lerp(
        IDLE_CAMERA_Z,
        DRAG_CAMERA_Z,
        currentViewZoom
      );

      if (interactive && ready && !activeSlugRef.current && !focused) {
        updateWallLayout();
      }

      if (interactive && hovered?.userData.orbHighlight.active) {
        drawOrbHighlight(
          hovered.userData.orbHighlight,
          new THREE.Color(hovered.userData.project.accent)
        );
      }

      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    };

    tickRef.current = tick;

    type PendingTextureJob = {
      index: number;
      project: PortfolioProject;
      image: HTMLImageElement;
      sourceTexture: THREE.Texture;
    };

    const pendingTextureJobs: PendingTextureJob[] = [];
    let textureBuildFrame = 0;
    let meshBuildFrame = 0;
    let idleRenderFrame = 0;

    const applyCardTexture = (index: number, cardTexture: THREE.CanvasTexture) => {
      cardTextures[index] = cardTexture;

      for (const mesh of cardMeshes) {
        if (mesh.userData.project.slug === projects[index].slug) {
          mesh.material.map = cardTexture;
          mesh.material.needsUpdate = true;
        }
      }

      updateWallLayout();
    };

    const buildNextTexture = () => {
      textureBuildFrame = 0;
      const next = pendingTextureJobs.shift();

      if (!next || session !== sessionRef.current) {
        return;
      }

      const cardTexture = createCardTexture(
        next.project,
        next.image,
        renderer.capabilities.getMaxAnisotropy()
      );
      next.sourceTexture.dispose();
      applyCardTexture(next.index, cardTexture);

      if (pendingTextureJobs.length > 0) {
        textureBuildFrame = window.requestAnimationFrame(buildNextTexture);
      }
    };

    const flushPendingTextures = () => {
      if (pendingTextureJobs.length === 0 || textureBuildFrame !== 0) {
        return;
      }

      textureBuildFrame = window.requestAnimationFrame(buildNextTexture);
    };

    flushTexturesRef.current = flushPendingTextures;

    const startTextureLoading = () => {
      const textureLoader = new THREE.TextureLoader();
      projects.forEach((project, index) => {
        textureLoader.load(project.heroImage, (loaded) => {
          if (session !== sessionRef.current) {
            loaded.dispose();
            return;
          }

          pendingTextureJobs.push({
            index,
            project,
            image: loaded.image as HTMLImageElement,
            sourceTexture: loaded,
          });

          flushPendingTextures();
        });
      });
    };

    const finalizeSetup = () => {
      ready = true;
      updateWallLayout();

      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);

      mount.addEventListener("pointerdown", onPointerDown);
      mount.addEventListener("pointermove", onPointerMove);
      mount.addEventListener("pointerup", onPointerUp);
      mount.addEventListener("pointercancel", onPointerUp);
      mount.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("resize", resize);
      startTextureLoading();
      tick();
    };

    const createCardMesh = (idx: number) => {
      const col = idx % RENDER_COLS;
      const row = Math.floor(idx / RENDER_COLS);
      const projIdx = idx % projects.length;

      const material = new THREE.MeshBasicMaterial({
        map: placeholderTexture,
        transparent: true,
        opacity: 1,
      });
      materials.push(material);

      const orbHighlight = createOrbHighlightState();

      const backgroundMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      materials.push(backgroundMaterial);

      const orbMaterial = new THREE.MeshBasicMaterial({
        map: orbHighlight.texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      materials.push(orbMaterial);

      const highlightEdgeMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: CARD_BORDER_OPACITY,
        depthWrite: false,
      });
      materials.push(highlightEdgeMaterial);

      const mesh = new THREE.Mesh(cardGeometry, material) as CardMesh;
      mesh.userData = {
        project: projects[projIdx],
        col,
        row,
        orbMaterial,
        backgroundMaterial,
        orbHighlight,
        highlightEdgeMaterial,
      };

      const backgroundOverlay = new THREE.Mesh(cardGeometry, backgroundMaterial);
      backgroundOverlay.position.z = 0.008;
      backgroundOverlay.renderOrder = 0;
      mesh.add(backgroundOverlay);

      const orbOverlay = new THREE.Mesh(cardGeometry, orbMaterial);
      orbOverlay.position.z = 0.015;
      orbOverlay.renderOrder = 1;
      mesh.add(orbOverlay);

      const highlightEdges = new THREE.LineSegments(
        highlightGeometry,
        highlightEdgeMaterial
      );
      highlightEdges.position.z = 0.02;
      highlightEdges.renderOrder = 2;
      mesh.add(highlightEdges);

      wallGroup.add(mesh);
      cardMeshes.push(mesh);
      pickTargets.push(mesh);
    };

    let meshIndex = 0;
    const MESH_BATCH = 10;

    const createMeshBatch = () => {
      meshBuildFrame = 0;

      if (session !== sessionRef.current) {
        return;
      }

      const end = Math.min(meshIndex + MESH_BATCH, cardCount);
      for (; meshIndex < end; meshIndex += 1) {
        createCardMesh(meshIndex);
      }

      if (meshIndex < cardCount) {
        meshBuildFrame = window.requestAnimationFrame(createMeshBatch);
        return;
      }

      finalizeSetup();
    };

    meshBuildFrame = window.requestAnimationFrame(createMeshBatch);

    return () => {
      flushTexturesRef.current = null;
      if (textureBuildFrame !== 0) {
        window.cancelAnimationFrame(textureBuildFrame);
      }
      if (meshBuildFrame !== 0) {
        window.cancelAnimationFrame(meshBuildFrame);
      }
      sessionRef.current += 1;
      ready = false;
      tickRef.current = null;
      window.cancelAnimationFrame(animationFrame);
      animationFrameRef.current = 0;
      mount.removeEventListener("pointerdown", onPointerDown);
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerup", onPointerUp);
      mount.removeEventListener("pointercancel", onPointerUp);
      mount.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", resize);
      resetFocus();
      resetFocusRef.current = null;

      cardGeometry.dispose();
      highlightGeometry.dispose();
      renderTarget.dispose();
      placeholderTexture.dispose();

      for (const mesh of cardMeshes) {
        mesh.userData.orbHighlight.texture.dispose();
      }

      for (const material of materials) {
        material.dispose();
      }
      for (const texture of cardTextures) {
        texture?.dispose();
      }

      renderer.forceContextLoss();
      renderer.dispose();
      scene.clear();
      clearMount(mount);
    };
  }, [projects]);

  useEffect(() => {
    if (activeProjectSlug === null) {
      resetFocusRef.current?.();
    }
  }, [activeProjectSlug]);

  return (
    <div
      className={`relative z-0 h-screen w-full overflow-hidden bg-black ${
        activeProjectSlug ? "pointer-events-none" : ""
      }`}
    >
      <div
        ref={mountRef}
        className="absolute inset-0 z-0 touch-none cursor-grab active:cursor-grabbing"
        aria-label="Interactive project wall gallery"
      />
    </div>
  );
}
