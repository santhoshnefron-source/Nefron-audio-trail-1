'use client';

import * as React from 'react';
import * as THREE from 'three';
import { Maximize2, RotateCcw, AlertCircle, HelpCircle, Laptop, Settings, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface StemValue {
  id: string;
  name: string;
  category: 'vocal' | 'instrument' | 'object';
  value: number;
  color: string;
}

interface Theater3DProps {
  stems: StemValue[];
  isPlaying: boolean;
}

export function Theater3D({ stems, isPlaying }: Theater3DProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const rendererRef = React.useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = React.useRef<THREE.Scene | null>(null);
  const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'cinematic' | 'free' | 'back'>('cinematic');
  const [controlsInfo, setControlsInfo] = React.useState('');
  const [isEntireScreen, setIsEntireScreen] = React.useState(false);
  const [webGlSupported, setWebGlSupported] = React.useState(true);
  
  // Ref to hold reference-to-mesh elements for laser beams to rotate/pulse them in anim loop
  const lasersRef = React.useRef<{
    mesh: THREE.Mesh;
    stemId: string;
    originalRadius: number;
    targetScale: number;
    speed: number;
    phase: number;
  }[]>([]);

  // Track double tap state
  const lastTapRef = React.useRef<number>(0);

  // Smooth camera target
  const targetCamPos = React.useRef<THREE.Vector3>(new THREE.Vector3(0, 6, 20));
  const currentCamPos = React.useRef<THREE.Vector3>(new THREE.Vector3(0, 6, 20));
  const camRotation = React.useRef<{ pitch: number; yaw: number }>({ pitch: -0.1, yaw: Math.PI });
  const isDragging = React.useRef<boolean>(false);
  const previousMousePosition = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  React.useEffect(() => {
    // Detect mobile device
    const mobileCheck = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;
    setIsMobile(mobileCheck);
    
    setControlsInfo(mobileCheck 
      ? 'Double-tap seats to teleport. Tap & Drag to look 360° fully.' 
      : 'Click & Drag to rotate view. Right-click & drag or WASD to move around. Double-click to focus.'
    );
  }, []);

  // Set camera predefined views
  const applyViewMode = (mode: 'cinematic' | 'free' | 'back') => {
    setViewMode(mode);
    if (!cameraRef.current) return;
    
    if (mode === 'cinematic') {
      // Sitting in prime row 4, looking at front screen
      targetCamPos.current.set(0, 3.2, 6);
      camRotation.current = { pitch: 0.1, yaw: Math.PI };
    } else if (mode === 'back') {
      // Standing at back high entrance looking down at screen
      targetCamPos.current.set(0, 5.0, 16.5);
      camRotation.current = { pitch: -0.15, yaw: Math.PI };
    } else {
      // Free angled orbit overview
      targetCamPos.current.set(10, 8, 12);
      camRotation.current = { pitch: -0.28, yaw: Math.PI * 1.25 };
    }
  };

  const stemsRef = React.useRef(stems);
  const isPlayingRef = React.useRef(isPlaying);
  
  React.useEffect(() => {
    stemsRef.current = stems;
    isPlayingRef.current = isPlaying;
  }, [stems, isPlaying]);

  // Setup Three.js scene
  React.useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 450;
    
    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060608);
    // Removed fog completely so that side wall and ceiling speakers never fade when viewing around
    sceneRef.current = scene;

    // 2. Camera - Increased far clipping plane to 500 to facilitate deep viewing without clipping
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 500);
    // Sit near center of room initially
    camera.position.set(0, 6, 20);
    cameraRef.current = camera;
    currentCamPos.current.copy(camera.position);

    // 3. Renderer
    const mobileCheck = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ 
        antialias: !mobileCheck, // Disable antialiasing on mobile for extreme 2GB memory optimization
        powerPreference: 'high-performance',
        precision: mobileCheck ? 'mediump' : 'highp'
      });
    } catch (e) {
      console.warn("WebGL is not supported or failed to initialize", e);
      setWebGlSupported(false);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(mobileCheck ? 1 : Math.min(window.devicePixelRatio, 2));
    
    // Clear old container contents and add canvas
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 2.5); // Rich warm ambient light
    scene.add(ambientLight);

    // Hemispherical Sky Fill Light for gorgeous top/down brightness
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x33333d, 3.2);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // Warm top lighting matching aesthetic
    const topLight = new THREE.DirectionalLight(0xffa260, 2.0);
    topLight.position.set(0, 15, 0);
    scene.add(topLight);

    // Dedicated key lights aimed directly at side walls to make Nefron speaker panels highly visible
    const leftWallKeyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    leftWallKeyLight.position.set(12, 6, 2);
    scene.add(leftWallKeyLight);

    const rightWallKeyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    rightWallKeyLight.position.set(-12, 6, 2);
    scene.add(rightWallKeyLight);

    const backWallKeyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    backWallKeyLight.position.set(0, 7, -10);
    scene.add(backWallKeyLight);

    // Soft screen backglow
    const screenGlow = new THREE.PointLight(0x00ccff, 2.0, 30);
    screenGlow.position.set(0, 5, -14.5);
    scene.add(screenGlow);

    // --- DRAW THEATER PARTS (Optimized according to 2GB mobile constraints) ---
    
    // Dimension variables translating from Blender's coordinates - Length doubled and height increased accordingly!
    const ROWS = 16;
    const COLUMNS = 12;
    const COLUMN_SPACING = 1.5;
    const CENTER_AISLE_WIDTH = 1.4;
    const ROW_SPACING = 2.0;
    const ROW_ELEVATION = 0.5;
    const FRONT_ROW_Z = 0.0; // Seats start near Z=0 and go back to Z=30
    const THEATER_WIDTH = 24.0;
    const THEATER_BACK_Z = 18.0; 
    const THEATER_FRONT_Z = -16.0;
    const THEATER_HEIGHT = 11.5; 

    // Common Materials (Upped brightness and added standard physical shading for visibility)
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x222226, // Lighter, visible dark-gray slate wall panels
      roughness: 0.6
    });
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x141417, // Elegant corporate gray carpet
      roughness: 0.85
    });
    const trimMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x0d0d0f, 
      roughness: 0.3 
    });
    const screenMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    // Materials for speaker panel components - GORGEOUS STEALTH DARK NEFRON CABINETS (Highly visible & beautifully defined under any light)
    const speakerBodyMat = new THREE.MeshStandardMaterial({ 
      color: 0x2a2c31, // Elegant satin charcoal grey for clean contrast with dark walls
      roughness: 0.55,
      metalness: 0.20,
      emissive: 0x121316 // Subtle warm deep-grey emissive to define borders under sharp angles
    });
    const driverConeMat = new THREE.MeshStandardMaterial({ 
      color: 0x121418, // Rich carbon-black driver cones
      roughness: 0.70,
      metalness: 0.15,
      emissive: 0x07080a // Keeps the cone shape defined in the shade
    });
    const metalMat = new THREE.MeshStandardMaterial({ 
      color: 0x40434e, // High-contrast satin titanium for caps and trim lines
      roughness: 0.35, 
      metalness: 0.60, // Beautiful metallic highlights to catch spotlights
      emissive: 0x15161a
    });
    const seatUpholsteryMat = new THREE.MeshStandardMaterial({ 
      color: 0xb91c1c, // Vibrant velvet red seats
      roughness: 0.75 
    });

    // 1. Floor Stepped Risers
    // Ground plane/risers
    const riserGroup = new THREE.Group();
    scene.add(riserGroup);

    // Lower front landing
    const frontLandingGeo = new THREE.BoxGeometry(THEATER_WIDTH, 0.3, Math.abs(THEATER_FRONT_Z - 1.0));
    const frontLanding = new THREE.Mesh(frontLandingGeo, floorMaterial);
    // front is negative Z in Three.js
    frontLanding.position.set(0, -0.15, (THEATER_FRONT_Z + 1.0) / 2);
    riserGroup.add(frontLanding);

    // Shared row geometries for standard risers
    const riserGeo = new THREE.BoxGeometry(THEATER_WIDTH, 1.0, ROW_SPACING);
    
    for (let row = 0; row < ROWS; row++) {
      const zPos = FRONT_ROW_Z + row * ROW_SPACING; // moving backward (+Z)
      const topElevation = row * ROW_ELEVATION;
      
      const riser = new THREE.Mesh(riserGeo, floorMaterial);
      riser.position.set(0, topElevation - 0.5, zPos);
      riserGroup.add(riser);

      // Add a simple gold/silver LED trim line along the riser edge for stunning visibility
      if (row > 0) {
        const stripGeo = new THREE.BoxGeometry(THEATER_WIDTH, 0.03, 0.08);
        const stripMat = new THREE.MeshBasicMaterial({ color: 0xffaa44 });
        const strip = new THREE.Mesh(stripGeo, stripMat);
        strip.position.set(0, topElevation, zPos - ROW_SPACING / 2 - 0.04);
        riserGroup.add(strip);
      }
    }

    // Rear high landing
    const rearLandingDepth = Math.abs(THEATER_BACK_Z - (FRONT_ROW_Z + (ROWS - 1) * ROW_SPACING + 1.0));
    const rearLandingGeo = new THREE.BoxGeometry(THEATER_WIDTH, (ROWS - 1) * ROW_ELEVATION + 0.3, rearLandingDepth);
    const rearLanding = new THREE.Mesh(rearLandingGeo, floorMaterial);
    rearLanding.position.set(0, ((ROWS - 1) * ROW_ELEVATION) / 2 - 0.15, THEATER_BACK_Z - rearLandingDepth/2);
    riserGroup.add(rearLanding);

    // 2. Main Outer Structure
    const wallsGroup = new THREE.Group();
    scene.add(wallsGroup);

    // Left wall
    const sideWallGeo = new THREE.BoxGeometry(0.35, THEATER_HEIGHT, Math.abs(THEATER_FRONT_Z - THEATER_BACK_Z));
    const leftWall = new THREE.Mesh(sideWallGeo, wallMaterial);
    leftWall.position.set(-THEATER_WIDTH / 2 - 0.175, THEATER_HEIGHT / 2, (THEATER_FRONT_Z + THEATER_BACK_Z) / 2);
    wallsGroup.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(sideWallGeo, wallMaterial);
    rightWall.position.set(THEATER_WIDTH / 2 + 0.175, THEATER_HEIGHT / 2, (THEATER_FRONT_Z + THEATER_BACK_Z) / 2);
    wallsGroup.add(rightWall);

    // Ceiling
    const ceilingGeo = new THREE.BoxGeometry(THEATER_WIDTH + 0.7, 0.35, Math.abs(THEATER_FRONT_Z - THEATER_BACK_Z) + 0.7);
    const ceiling = new THREE.Mesh(ceilingGeo, wallMaterial);
    ceiling.position.set(0, THEATER_HEIGHT + 0.175, (THEATER_FRONT_Z + THEATER_BACK_Z) / 2);
    wallsGroup.add(ceiling);

    // Front Wall with Screen - Matched to a wider and centered cinema display
    const frontWallLeft = new THREE.Mesh(new THREE.BoxGeometry(2, THEATER_HEIGHT, 0.35), wallMaterial);
    frontWallLeft.position.set(-11, THEATER_HEIGHT/2, THEATER_FRONT_Z);
    wallsGroup.add(frontWallLeft);

    const frontWallRight = new THREE.Mesh(new THREE.BoxGeometry(2, THEATER_HEIGHT, 0.35), wallMaterial);
    frontWallRight.position.set(11, THEATER_HEIGHT/2, THEATER_FRONT_Z);
    wallsGroup.add(frontWallRight);

    // Movie Screen (16:9 widescreen cinema size) - Kept white as requested
    const movieScreenGeo = new THREE.PlaneGeometry(20, 11);
    const movieScreen = new THREE.Mesh(movieScreenGeo, screenMaterial);
    const SCREEN_Y = 8.5; // Raised center screen since the seating slope gets higher
    movieScreen.position.set(0, SCREEN_Y, THEATER_FRONT_Z + 0.05);
    scene.add(movieScreen);

    // Screen frame
    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 11, 0.12), trimMaterial);
    frameLeft.position.set(-10.09, SCREEN_Y, THEATER_FRONT_Z + 0.04);
    scene.add(frameLeft);

    const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.18, 11, 0.12), trimMaterial);
    frameRight.position.set(10.09, SCREEN_Y, THEATER_FRONT_Z + 0.04);
    scene.add(frameRight);

    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(20.36, 0.18, 0.12), trimMaterial);
    frameTop.position.set(0, SCREEN_Y + 5.59, THEATER_FRONT_Z + 0.04);
    scene.add(frameTop);

    const frameBottom = new THREE.Mesh(new THREE.BoxGeometry(20.36, 0.18, 0.12), trimMaterial);
    frameBottom.position.set(0, SCREEN_Y - 5.59, THEATER_FRONT_Z + 0.04);
    scene.add(frameBottom);

    // 3. SEATING ARRAY
    const seatsGroup = new THREE.Group();
    scene.add(seatsGroup);

    // Shared textures/geometries for optimized 2GB rendering
    // High-poly for desktop, low-poly for mobile
    const cushionGeo = mobileCheck 
      ? new THREE.BoxGeometry(0.9, 0.25, 0.9) 
      : new THREE.BoxGeometry(1.0, 0.3, 1.05);
    const backGeo = mobileCheck 
      ? new THREE.BoxGeometry(0.9, 0.85, 0.15) 
      : new THREE.BoxGeometry(1.0, 1.1, 0.18);
    const armrestGeo = new THREE.BoxGeometry(0.14, 0.28, 0.95);
    const legGeo = new THREE.BoxGeometry(0.08, 0.55, 0.08);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLUMNS; col++) {
        // Compute position
        let x = (col - (COLUMNS - 1) / 2.0) * COLUMN_SPACING;
        if (col < COLUMNS / 2.0) {
          x -= CENTER_AISLE_WIDTH / 2.0;
        } else {
          x += CENTER_AISLE_WIDTH / 2.0;
        }

        const z = FRONT_ROW_Z + row * ROW_SPACING;
        const yBase = row * ROW_ELEVATION;

        // Assembly chair in its local space to easily place and raycast
        const chair = new THREE.Group();
        chair.position.set(x, yBase, z);
        chair.name = `Seat_R${row + 1}_C${col + 1}`;
        chair.userData = { isSeat: true, row: row + 1, col: col + 1, x, y: yBase + 1.2, z };

        // Rotate seats 180 degrees around Y so they face the screen at negative Z perfectly!
        chair.rotation.y = Math.PI;

        // Cushions
        const cushion = new THREE.Mesh(cushionGeo, seatUpholsteryMat);
        cushion.position.set(0, 0.55, 0); // elevated from plate
        chair.add(cushion);

        const backrest = new THREE.Mesh(backGeo, seatUpholsteryMat);
        backrest.position.set(0, 1.1, -0.4);
        chair.add(backrest);

        if (!mobileCheck) {
          // Legs
          const leg1 = new THREE.Mesh(legGeo, metalMat);
          leg1.position.set(-0.38, 0.275, 0.35);
          chair.add(leg1);

          const leg2 = new THREE.Mesh(legGeo, metalMat);
          leg2.position.set(0.38, 0.275, 0.35);
          chair.add(leg2);

          const leg3 = new THREE.Mesh(legGeo, metalMat);
          leg3.position.set(-0.38, 0.275, -0.35);
          chair.add(leg3);

          const leg4 = new THREE.Mesh(legGeo, metalMat);
          leg4.position.set(0.38, 0.275, -0.35);
          chair.add(leg4);

          // Armrests
          const arm1 = new THREE.Mesh(armrestGeo, metalMat);
          arm1.position.set(-0.55, 0.8, 0);
          chair.add(arm1);

          const arm2 = new THREE.Mesh(armrestGeo, metalMat);
          arm2.position.set(0.55, 0.8, 0);
          chair.add(arm2);
        }

        seatsGroup.add(chair);
      }
    }

    // 4. NEFRON SURROUND SPEAKER MODULES
    const speakersGroup = new THREE.Group();
    scene.add(speakersGroup);

    // Optimized cabinet mesh definitions
    const panelSize = 1.35;
    const panelDepth = 0.45;
    const panelGeo = new THREE.BoxGeometry(panelSize, panelSize, panelDepth);

    // Helper to build a speaker panel reproducing the exact convex curved look and 3x3 drivers arrangement of the image!
    const instantiateSpeaker = (name: string, posX: number, posY: number, posZ: number, rotX: number, rotY: number, rotZ: number) => {
      const panel = new THREE.Group();
      panel.name = name;
      panel.position.set(posX, posY, posZ);
      panel.rotation.set(rotX, rotY, rotZ);

      // Wrapper to ensure that every speaker mesh created is never culled by frustum culling
      const createMesh = (geom: THREE.BufferGeometry, mat: THREE.Material) => {
        const m = new THREE.Mesh(geom, mat);
        m.frustumCulled = false;
        return m;
      };

      // Curved convex cabinet representation
      const cabinetGroup = new THREE.Group();
      
      // Main back casing - Sized to embed cleanly inside walls and not protrude through the back
      const cabinetBase = createMesh(new THREE.BoxGeometry(panelSize - 0.05, panelSize - 0.05, 0.40), speakerBodyMat);
      cabinetBase.position.set(0, 0, -0.20);
      cabinetGroup.add(cabinetBase);
      panel.add(cabinetGroup);

      // 3x3 driver grid following the convex curved face perfectly!
      // Image 1: Instead of solid columns, each driver is mounted in its own distinct SQUARE PLATE.
      const gridOffset = panelSize / 3;
      const plateSize = gridOffset - 0.04; // Leaves a tiny 0.04 gap between squares to emulate modular plates
      const driverRadius = mobileCheck ? 0.11 : 0.13;
      
      // Detailed circular speaker components (rubber outer ring, paper cone, dust dome caps)
      const squarePlateGeo = new THREE.BoxGeometry(plateSize, plateSize, 0.12);
      const ringGeo = new THREE.TorusGeometry(driverRadius, driverRadius * 0.15, 8, mobileCheck ? 10 : 20);
      const coneGeo = new THREE.CylinderGeometry(0.01, driverRadius * 0.85, 0.04, mobileCheck ? 8 : 16);
      coneGeo.rotateX(Math.PI / 2);
      
      const capGeo = new THREE.SphereGeometry(driverRadius * 0.33, mobileCheck ? 5 : 10, mobileCheck ? 5 : 10);
      capGeo.scale(1, 1, 0.5);

      for (let gridY = -1; gridY <= 1; gridY++) {
        for (let gridX = -1; gridX <= 1; gridX++) {
          const fx = gridX * gridOffset;
          const fy = gridY * gridOffset;

          const driverGroup = new THREE.Group();
          
          // Position and rotate drivers so they stay flush on the curved surface faces
          if (gridX === -1) {
            driverGroup.position.set(fx, fy, panelDepth / 2 - 0.048);
            driverGroup.rotation.y = -0.22;
          } else if (gridX === 1) {
            driverGroup.position.set(fx, fy, panelDepth / 2 - 0.048);
            driverGroup.rotation.y = 0.22;
          } else {
            driverGroup.position.set(fx, fy, panelDepth / 2 - 0.008);
          }

          // 0. The Modular Square Plate Front Baffle
          const squarePlate = createMesh(squarePlateGeo, speakerBodyMat);
          squarePlate.position.set(0, 0, -0.06);
          driverGroup.add(squarePlate);

          // 1. Rubber Outer Ring
          const ring = createMesh(ringGeo, driverConeMat);
          ring.position.set(0, 0, 0.02);
          driverGroup.add(ring);

          // 2. Recessed Cone
          const cone = createMesh(coneGeo, driverConeMat);
          cone.position.set(0, 0, 0.01);
          driverGroup.add(cone);

          // 3. Central Cap / Dome
          const cap = createMesh(capGeo, metalMat);
          cap.position.set(0, 0, 0.025);
          driverGroup.add(cap);

          panel.add(driverGroup);
        }
      }

      speakersGroup.add(panel);
      return panel;
    };

    // Calculate height at position mimicking the sloping floor
    const slopeHeight = (z: number) => {
      const fraction = Math.max(0.0, Math.min(1.0, z / ((ROWS-1) * ROW_SPACING)));
      return fraction * ((ROWS-1) * ROW_ELEVATION);
    };

    const ceilingYBase = THEATER_HEIGHT - 0.45; // Offset to prevent clipping into ceiling
    const sideOffset = THEATER_WIDTH / 2 - 0.45; 

    // Side Wall Speakers
    const sideWallPositions = [
      { id: '01', z: 12.0, heightOffset: 6.95 },
      { id: '02', z: 4.0, heightOffset: 6.95 },
      { id: '03', z: 8.0, heightOffset: 5.05 },
      { id: '04', z: 12.0, heightOffset: 3.35 },
      { id: '05', z: 4.0, heightOffset: 3.35 },
    ];
    let sideIdx = 1;
    sideWallPositions.forEach(pos => {
      const slopeAdjust = slopeHeight(pos.z);
      const finalY = slopeAdjust + pos.heightOffset;
      // Left wall
      instantiateSpeaker(`Left_Wall_Speaker_${pos.id}`, -sideOffset, finalY, pos.z, 0, Math.PI / 2, 0);
      // Right wall
      instantiateSpeaker(`Right_Wall_Speaker_${pos.id}`, sideOffset, finalY, pos.z, 0, -Math.PI / 2, 0);
      sideIdx++;
    });

    // Rear wall speakers
    const rearZ = THEATER_BACK_Z - 0.45;
    const rearFloorZ = (ROWS - 1) * ROW_ELEVATION;
    const rearPositions = [
      { x: -6.2, y: rearFloorZ + 6.00 },
      { x: 6.2, y: rearFloorZ + 6.00 },
      { x: 0.0, y: rearFloorZ + 4.70 },
      { x: -6.2, y: rearFloorZ + 3.15 },
      { x: 6.2, y: rearFloorZ + 3.15 },
    ];
    rearPositions.forEach((pos, i) => {
      instantiateSpeaker(`Rear_Wall_Speaker_${(i+1).toString().padStart(2, '0')}`, pos.x, pos.y, rearZ, 0, Math.PI, 0);
    });

    // Ceiling speakers
    const ceilingRows = [
      { z: 13.0, xs: [-5.6, 0.0, 5.6] },
      { z: 8.0, xs: [-2.8, 2.8] },
      { z: 3.0, xs: [-5.6, 0.0, 5.6] },
      { z: -2.0, xs: [-2.8, 2.8] },
      { z: -7.0, xs: [-5.6, 0.0, 5.6] },
      { z: -12.0, xs: [-2.8, 2.8] },
    ];
    let ceilPanelIndex = 1;
    ceilingRows.forEach(row => {
      row.xs.forEach(x => {
        instantiateSpeaker(`Ceiling_Speaker_${ceilPanelIndex.toString().padStart(2, '0')}`, x, ceilingYBase, row.z, Math.PI / 2, 0, 0);
        ceilPanelIndex++;
      });
    });

    // --- LASERS (DYNAMIC SHIFT BEAMS) ---
    // Let's create an elegant helper to build neon glowing tubes mapping to visual levels
    const buildLaserBeams = () => {
      // Clear previous laser meshes
      lasersRef.current.forEach(l => scene.remove(l.mesh));
      lasersRef.current = [];

      stems.forEach(stem => {
        // Find matching speaker units
        let matchingSpeakers: THREE.Object3D[] = [];
        let targets: THREE.Vector3[] = [];

        if (stem.name.toLowerCase().includes('guitar')) {
          // Rule 1: Focus Beam - Side speakers target Row 4 (Left Wall mapped)
          matchingSpeakers = speakersGroup.children.filter(s => s.name.includes("Left_Wall_Speaker"));
          seatsGroup.children.forEach(s => {
            if (s.name.includes("Seat_R4")) {
              targets.push(new THREE.Vector3(s.userData.x, s.userData.y - 0.5, s.userData.z));
            }
          });
        } else if (stem.name.toLowerCase().includes('voice')) {
          // Rule 2: Object Tracking - Ceiling array tracks moving object on screen
          matchingSpeakers = speakersGroup.children.filter(s => s.name.includes("Ceiling_Speaker"));
          // Front screen targets for tracking
          targets = [
            new THREE.Vector3(-4.0, THEATER_HEIGHT / 2, THEATER_FRONT_Z),
            new THREE.Vector3(0.0, THEATER_HEIGHT / 2, THEATER_FRONT_Z),
            new THREE.Vector3(4.0, THEATER_HEIGHT / 2, THEATER_FRONT_Z),
          ];
        } else if (stem.category === 'vocal') {
          // Standard vocal distribution
          matchingSpeakers = speakersGroup.children.filter(s => s.name.includes("Ceiling_Speaker"));
          seatsGroup.children.forEach(s => {
            if (s.userData && s.userData.row >= 2 && s.userData.row <= 5 && s.userData.col >= 4 && s.userData.col <= 9) {
              targets.push(new THREE.Vector3(s.userData.x, s.userData.y - 0.5, s.userData.z));
            }
          });
        } else if (stem.category === 'instrument') {
          // Standard instruments (including drums/synth)
          matchingSpeakers = speakersGroup.children.filter(s => s.name.includes("Right_Wall_Speaker") || s.name.includes("Left_Wall_Speaker"));
          seatsGroup.children.forEach(s => {
            if (s.userData && s.userData.row >= 5) {
              targets.push(new THREE.Vector3(s.userData.x, s.userData.y - 0.5, s.userData.z));
            }
          });
        } else {
          // Rule 3: Dynamic driver emulation - Subwoofers or Spatial Objects sweep from bottom screen to ceiling
          matchingSpeakers = speakersGroup.children.filter(s => s.name.includes("Ceiling_Speaker_01") || s.name.includes("Ceiling_Speaker_03") || s.name.includes("Ceiling_Speaker_05"));
          // Sweep targets from screen bottom up
          targets = [
            new THREE.Vector3(0.0, 0.5, THEATER_FRONT_Z + 1.0), 
            new THREE.Vector3(-3.0, 2.0, THEATER_FRONT_Z + 3.0),
            new THREE.Vector3(3.0, 2.0, THEATER_FRONT_Z + 3.0),
            new THREE.Vector3(0.0, THEATER_HEIGHT - 2, THEATER_FRONT_Z + 5.0)
          ];
        }

        if (matchingSpeakers.length === 0 || targets.length === 0) return;

        // Choose up to 8 connections to avoid vertex explosion on mobile phone
        const maxConnections = mobileCheck ? 3 : 8;
        const count = Math.min(maxConnections, matchingSpeakers.length);
        
        for (let i = 0; i < count; i++) {
          const spk = matchingSpeakers[i % matchingSpeakers.length];
          const tgt = targets[Math.floor(Math.random() * targets.length)];

          const start = new THREE.Vector3();
          spk.getWorldPosition(start);
          
          // Compute direction and distance
          const distance = start.distanceTo(tgt);
          const radius = mobileCheck ? 0.015 : 0.03;

          // Glowing laser tube
          const laserGeo = new THREE.CylinderGeometry(radius, radius, distance, mobileCheck ? 3 : 6);
          // Cylinder points up, we need to orient it
          laserGeo.translate(0, distance / 2, 0);
          laserGeo.rotateX(Math.PI / 2);

          const laserMat = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(stem.color),
            transparent: true,
            opacity: 0, // start invisible, will animate opacity/glow
            depthWrite: false,
            blending: THREE.AdditiveBlending
          });

          const laserObj = new THREE.Mesh(laserGeo, laserMat);
          laserObj.position.copy(start);
          laserObj.lookAt(tgt);

          scene.add(laserObj);

          lasersRef.current.push({
            mesh: laserObj,
            stemId: stem.id,
            originalRadius: radius,
            targetScale: 1.0,
            speed: 1.5 + Math.random() * 2.0,
            phase: Math.random() * Math.PI * 2
          });
        }
      });
    };

    buildLaserBeams();

    // Prevent any possibility of object "fading" / disappearing from certain camera angles 
    // by turning off frustum culling globally on everything inside the entire theater.
    scene.traverse((obj) => {
      obj.frustumCulled = false;
    });

    // Resize observer to handle container size change and support immersive full screen/mobile viewport sizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (rendererRef.current && cameraRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // --- CONTROLLER LOGIC (DRAGGING & TAP TO LOOK AND DOUBLE-TAP NAVIGATION) ---
    
    // Smooth camera transition loop
    let animationFrameId: number;

    const animateLoop = () => {
      animationFrameId = requestAnimationFrame(animateLoop);

      // Smooth camera motion
      currentCamPos.current.lerp(targetCamPos.current, 0.06);
      camera.position.copy(currentCamPos.current);

      // Look direction math (spherical coordinates relative to camera pitch/yaw)
      const lookDir = new THREE.Vector3(
        Math.sin(camRotation.current.yaw) * Math.cos(camRotation.current.pitch),
        Math.sin(camRotation.current.pitch),
        Math.cos(camRotation.current.yaw) * Math.cos(camRotation.current.pitch)
      );
      camera.lookAt(camera.position.clone().add(lookDir));

      // Animate laser beam lines based on stems slider values and isPlaying music
      lasersRef.current.forEach(laser => {
        const matchingStem = stemsRef.current.find(s => s.id === laser.stemId);
        const stemVolume = matchingStem ? matchingStem.value : 0;
        const mat = laser.mesh.material as THREE.MeshBasicMaterial;

        if (isPlayingRef.current && stemVolume > 0) {
          // Dynamic pulsing
          laser.phase += 0.15;
          const pulse = Math.sin(laser.phase) * 0.35 + 0.65;
          
          // Map slider level and pulse to opacity and width
          mat.opacity = (stemVolume / 100) * 0.85 * pulse;
          const currentRadius = laser.originalRadius * (0.4 + (stemVolume / 100) * 1.5) * pulse;
          
          // Smoothly scale laser width using scale properties rather than rebuilding geometry
          laser.mesh.scale.set(currentRadius / laser.originalRadius, currentRadius / laser.originalRadius, 1.0);
          
          // Screen remains solid bright white as requested
          const scrMat = movieScreen.material as THREE.MeshBasicMaterial;
          scrMat.color.setHex(0xffffff);
        } else {
          // Off / invisible
          mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.0, 0.1);
          laser.mesh.scale.set(0.01, 0.01, 1.0);
          
          // Stable elegant pure white screen
          const scrMat = movieScreen.material as THREE.MeshBasicMaterial;
          scrMat.color.setHex(0xffffff);
        }
      });

      renderer.render(scene, camera);
    };

    animateLoop();

    // Cleanup elements on component unmount
    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      
      // Dispose materials and geometries to liberate memory on mobile
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose());
        } else {
          object.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, []); // Run only once to avoid WebGL context loss

  // Handle Drag Move (orbit rotation look around)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    containerRef.current?.setPointerCapture(e.pointerId);
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    
    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;
    
    // Map control pitch & yaw looks
    camRotation.current.yaw += deltaX * 0.005;
    camRotation.current.pitch += deltaY * 0.005;
    
    // Bound camera rotation preventing flip over
    const limit = Math.PI / 2.0 - 0.05;
    camRotation.current.pitch = Math.max(-limit, Math.min(limit, camRotation.current.pitch));
    
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    containerRef.current?.releasePointerCapture(e.pointerId);

    // Double tap handling on mobile phone / target double click
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < 280;
    lastTapRef.current = now;

    if (isDoubleTap) {
      handleDoubleAction(e);
    }
  };

  // Double-tap or double-click to teleport to seat/position
  const handleDoubleAction = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cameraRef.current || !sceneRef.current || !containerRef.current) return;

    // Build Raycaster
    const rect = containerRef.current.getBoundingClientRect();
    const xRatio = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const yRatio = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(xRatio, yRatio), cameraRef.current);

    // Grab all seats and floor riser intersections
    const intersects = raycaster.intersectObjects(sceneRef.current.children, true);
    
    if (intersects.length > 0) {
      // Find the clicked object, looking for parents belonging to seat groups
      for (const hit of intersects) {
        let parent: THREE.Object3D | null = hit.object;
        while (parent && parent !== sceneRef.current) {
          if (parent.name.includes("Seat_")) {
            const data = parent.userData;
            if (data && typeof data.x === 'number') {
              // Smooth seat view teleport! Set target level at standard seating height
              targetCamPos.current.set(data.x, data.y + 0.3, data.z);
              // Face the movie screen at negative Z
              camRotation.current = { pitch: 0.1, yaw: Math.PI };
              return;
            }
          }
          parent = parent.parent;
        }

        // Fallback to floor riser hits
        if (hit.object.name.includes("Riser") || hit.object.name.includes("Landing") || hit.object.name.includes("floor") || hit.point.y < 5.0) {
          // Teleport to floor height
          targetCamPos.current.set(hit.point.x, hit.point.y + 1.2, hit.point.z);
          return;
        }
      }
    }
  };

  if (!webGlSupported) {
    return (
      <div className="bg-gray-dark/40 border border-[var(--glow-color-strong)]/30 rounded-3xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-headline tracking-widest text-lg font-bold text-foreground uppercase flex items-center gap-2">
              <Compass className="w-5 h-5 text-[var(--logo-gradient-start)] anim-pulse" />
              Nefron Acoustic Space Mapping
            </h3>
            <p className="text-xs text-muted mt-0.5 select-none font-mono text-cyan-400">
              Interactive 2D schematic loader (WebGL fallback)
            </p>
          </div>
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-500/80 text-xs rounded-xl font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>WebGL unavailable in container — high-fidelity 2D interface activated</span>
          </div>
        </div>

        <div className="relative w-full h-[380px] sm:h-[480px] bg-black rounded-2xl border border-foreground/10 shadow-2xl overflow-hidden flex flex-col md:flex-row p-4 gap-4">
          {/* Custom 2D Theater Grid Representation */}
          <div className="flex-1 relative bg-black rounded-xl border border-white/5 p-4 flex flex-col justify-between overflow-hidden">
            {/* Stage Screen Representing Front Z */}
            <div className="w-full text-center border-b border-cyan-500/30 pb-2 mb-4">
              <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-bold">THEATER VIDEO SCREEN (FRONT)</span>
              <div className="w-2/3 h-1 bg-gradient-to-r from-cyan-500/0 via-cyan-400/50 to-cyan-500/0 mx-auto mt-1" />
            </div>

            {/* Speaker Node Layout */}
            <div className="flex-1 grid grid-cols-3 gap-4 items-center justify-items-center py-4 relative">
              {/* Overlay laser beams representing speaker output */}
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-transparent via-cyan-950/5 to-transparent flex items-center justify-center opacity-40" />
              
              {/* Left Wall speaker column */}
              <div className="flex flex-col gap-3 items-center mt-6">
                <span className="text-[9px] font-mono text-muted uppercase">Left Wall Arrays</span>
                {stems.slice(0, 5).map((s, idx) => (
                  <div 
                    key={`left-${s.id}`} 
                    className="flex flex-col items-center gap-1 p-2 bg-white/5 rounded-lg border border-white/5 hover:border-white/10"
                    style={{ borderColor: isPlaying && s.value > 0 ? `${s.color}33` : 'rgba(255,255,255,0.05)' }}
                  >
                    <span className="text-[8px] font-mono text-muted text-gray-400 capitalize">{s.id}-Ch</span>
                    <div className="w-8 h-2 bg-gray-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-150" 
                        style={{ width: `${s.value}%`, backgroundColor: s.color }} 
                      />
                    </div>
                    <span className="text-[9px] font-mono font-bold" style={{ color: s.color }}>{s.value}%</span>
                  </div>
                ))}
              </div>

              {/* Ceiling speakers list */}
              <div className="flex flex-col gap-3 items-center">
                <span className="text-[9px] font-mono text-muted uppercase">Ceiling Arrays</span>
                <div className="grid grid-cols-2 gap-3 items-center justify-items-center">
                  {stems.slice(0, 5).map((s, idx) => (
                    <div 
                      key={`ceil-${s.id}`} 
                      className={cn("flex flex-col items-center gap-1 p-2 bg-white/5 rounded-lg border border-white/5 hover:border-white/10", idx === 2 ? "col-span-2" : "")}
                      style={{ borderColor: isPlaying && s.value > 0 ? `${s.color}33` : 'rgba(255,255,255,0.05)' }}
                    >
                      <span className="text-[8px] font-mono text-muted text-gray-400 capitalize">{s.id}-Ch</span>
                      <div className="w-8 h-2 bg-gray-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-150" 
                          style={{ width: `${s.value}%`, backgroundColor: s.color }} 
                        />
                      </div>
                      <span className="text-[9px] font-mono font-bold" style={{ color: s.color }}>{s.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Wall speaker column */}
              <div className="flex flex-col gap-3 items-center mt-6">
                <span className="text-[9px] font-mono text-muted uppercase">Right Wall Arrays</span>
                {stems.slice(4, 9).map((s, idx) => (
                  <div 
                    key={`right-${s.id}`} 
                    className="flex flex-col items-center gap-1 p-2 bg-white/5 rounded-lg border border-white/5 hover:border-white/10"
                    style={{ borderColor: isPlaying && s.value > 0 ? `${s.color}33` : 'rgba(255,255,255,0.05)' }}
                  >
                    <span className="text-[8px] font-mono text-muted text-gray-400 capitalize">{s.id}-Ch</span>
                    <div className="w-8 h-2 bg-gray-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-150" 
                        style={{ width: `${s.value}%`, backgroundColor: s.color }} 
                      />
                    </div>
                    <span className="text-[9px] font-mono font-bold" style={{ color: s.color }}>{s.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Balcony / Back Wall (Quincunx 5 Speaker Sub-Layout) */}
            <div className="w-full text-center border-t border-white/5 pt-3 mt-4">
              <div className="text-[9px] font-mono text-muted uppercase mb-2">Rear Wall Surround Array (5 Speakers Config)</div>
              <div className="flex justify-center gap-3">
                {stems.slice(3, 8).map((s, idx) => (
                  <div 
                    key={`rear-${s.id}`} 
                    className="flex flex-col items-center gap-1 p-2 bg-white/5 rounded-lg border border-white/5 hover:border-white/10"
                    style={{ borderColor: isPlaying && s.value > 0 ? `${s.color}33` : 'rgba(255,255,255,0.05)' }}
                  >
                    <span className="text-[8px] font-mono text-muted text-gray-400 capitalize">{s.id}-Ch</span>
                    <div className="w-8 h-2 bg-gray-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-150" 
                        style={{ 
                          width: `${s.value}%`, 
                          backgroundColor: s.color 
                        }} 
                      />
                    </div>
                    <span className="text-[9px] font-mono font-bold" style={{ color: s.color }}>{s.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Level Monitors side panel */}
          <div className="w-full md:w-64 bg-black rounded-xl border border-white/5 p-4 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono font-bold text-foreground tracking-widest uppercase mb-3 text-cyan-400">ACOUSTIC OUTPUTS</div>
              <div className="space-y-3">
                {stems.map(s => (
                  <div key={s.id} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-foreground font-bold">{s.name}</span>
                      <span className="font-bold font-mono" style={{ color: s.color }}>{s.value}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-950 rounded-full overflow-hidden p-[1px] border border-white/5">
                      <div 
                        className="h-full rounded-full transition-all duration-150" 
                        style={{ 
                          width: `${s.value}%`, 
                          backgroundColor: s.color,
                          boxShadow: `0 0 10px ${s.color}`
                        }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/5 pt-3 mt-4 text-[10px] font-mono text-muted flex flex-col gap-1">
              <div className="flex justify-between">
                <span>Power Mode:</span>
                <span className="text-emerald-400 font-bold uppercase">Optimized</span>
              </div>
              <div className="flex justify-between">
                <span>Decoder Stems:</span>
                <span className="text-foreground">{stems.length} Active</span>
              </div>
              <div className="flex justify-between">
                <span>Response Rate:</span>
                <span className="text-cyan-400">12ms (Analog)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Level footer summary showing audio stems mapped */}
        <div className="flex justify-between items-center text-xs font-mono text-muted p-2 bg-black/75 backdrop-blur-md rounded-xl border border-white/10 max-w-full">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[9px] uppercase tracking-widest text-[#93c5fd] font-bold">Nefron Stem Output:</span>
            {stems.map(s => (
              <span key={s.id} className="flex items-center gap-1 text-[10px] whitespace-nowrap shrink-0" style={{ color: s.color }}>
                <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: s.color }} />
                {s.name}:{s.value}%
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className={cn(
      isEntireScreen 
        ? "fixed inset-0 w-screen h-screen z-[100] bg-black flex flex-col overflow-hidden"
        : "bg-gray-dark/40 border border-[var(--glow-color-strong)]/30 rounded-3xl p-4 sm:p-6 space-y-4"
    )}>
      {isEntireScreen ? (
        <div className="absolute top-4 left-4 right-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-50 pointer-events-none select-none">
          <div className="p-3 bg-black/85 backdrop-blur-md border border-white/10 rounded-xl pointer-events-auto max-w-[280px]">
            <div className="flex items-center gap-2">
              <span className={cn("inline-block w-2.5 h-2.5 rounded-full", isPlaying ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
              <span className="text-[10px] font-mono tracking-widest text-foreground uppercase font-bold">
                Nefron Laser Matrix: {isPlaying ? "ACTIVE" : "READY"}
              </span>
            </div>
            <p className="text-[9px] font-mono text-muted mt-1">
              Teleport: Double-tap seat | Look 360°: Drag viewport
            </p>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto shrink-0 self-end sm:self-auto bg-black/50 p-1 rounded-xl backdrop-blur-sm border border-white/5">
            <button 
              type="button"
              onClick={() => applyViewMode('cinematic')}
              className={cn("px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border", viewMode === 'cinematic' ? "bg-[var(--logo-gradient-start)] text-white border-transparent" : "bg-black/85 text-muted border-white/10 hover:text-foreground")}
            >
              Cinematic
            </button>
            <button 
              type="button"
              onClick={() => applyViewMode('back')}
              className={cn("px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border", viewMode === 'back' ? "bg-[var(--logo-gradient-start)] text-white border-transparent" : "bg-black/85 text-muted border-white/10 hover:text-foreground")}
            >
              Balcony
            </button>
            <button 
              type="button"
              onClick={() => applyViewMode('free')}
              className={cn("px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors border", viewMode === 'free' ? "bg-[var(--logo-gradient-start)] text-white border-transparent" : "bg-black/85 text-muted border-white/10 hover:text-foreground")}
            >
              Aero
            </button>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    camRotation.current = { pitch: -0.1, yaw: Math.PI };
                    targetCamPos.current.set(0, 5, 12);
                    setViewMode('free');
                  }}
                  className="p-1.5 bg-black/85 hover:bg-black text-muted hover:text-foreground border border-white/10 rounded-lg transition-colors"
                >
                  <RotateCcw size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Reset View</TooltipContent>
            </Tooltip>

            <button
              type="button"
              onClick={() => setIsEntireScreen(false)}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600/90 hover:bg-red-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg border border-red-500/30 shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all ml-2"
            >
              Minimize View
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-headline tracking-widest text-lg font-bold text-foreground uppercase flex items-center gap-2">
              <Compass className="w-5 h-5 text-[var(--logo-gradient-start)] anim-pulse" />
              3D Nefron Virtual Theater
            </h3>
            <p className="text-xs text-muted mt-0.5 select-none font-mono text-cyan-400">
              {controlsInfo}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button 
              type="button"
              onClick={() => applyViewMode('cinematic')}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border", viewMode === 'cinematic' ? "bg-[var(--logo-gradient-start)] text-white border-transparent shadow-[0_0_10px_var(--logo-gradient-start)]" : "bg-black/40 text-muted border-foreground/10 hover:text-foreground")}
            >
              Cinematic prime view
            </button>
            <button 
              type="button"
              onClick={() => applyViewMode('back')}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border", viewMode === 'back' ? "bg-[var(--logo-gradient-start)] text-white border-transparent shadow-[0_0_10px_var(--logo-gradient-start)]" : "bg-black/40 text-muted border-foreground/10 hover:text-foreground")}
            >
              Back balcony
            </button>
            <button 
              type="button"
              onClick={() => applyViewMode('free')}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border", viewMode === 'free' ? "bg-[var(--logo-gradient-start)] text-white border-transparent shadow-[0_0_10px_var(--logo-gradient-start)]" : "bg-black/40 text-muted border-foreground/10 hover:text-foreground")}
            >
              Aero overview
            </button>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    camRotation.current = { pitch: -0.1, yaw: Math.PI };
                    targetCamPos.current.set(0, 5, 12);
                    setViewMode('free');
                  }}
                  className="p-1.5 bg-black/40 hover:bg-black/80 text-muted hover:text-foreground border border-foreground/10 rounded-lg transition-colors"
                >
                  <RotateCcw size={15} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Reset Navigation</TooltipContent>
            </Tooltip>

            <button
              type="button"
              onClick={() => setIsEntireScreen(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--logo-gradient-start)] hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider rounded-lg border border-transparent shadow-[0_0_12px_var(--glow-color-strong)] transition-all ml-1"
            >
              <Maximize2 size={13} />
              Entire Screen
            </button>
          </div>
        </div>
      )}

      {/* 3D Viewport container */}
      <div className={cn(
        "relative w-full overflow-hidden bg-black",
        isEntireScreen ? "flex-1 h-full" : "h-[380px] sm:h-[480px] rounded-2xl border border-foreground/10 shadow-2xl"
      )}>
        <div 
          ref={containerRef} 
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full cursor-grab active:cursor-grabbing outline-none select-none touch-none"
        />

        {!isEntireScreen && (
          <>
            <div className="absolute top-4 left-4 p-3 bg-black/80 backdrop-blur-md border border-foreground/10 rounded-xl pointer-events-none select-none max-w-xs space-y-2">
              <div className="flex items-center gap-2">
                <span className={cn("inline-block w-2.5 h-2.5 rounded-full", isPlaying ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
                <span className="text-[11px] font-mono tracking-widest text-foreground uppercase font-bold">
                  {isPlaying ? "Laser Engine: ACTIVE" : "Laser Engine: READY"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] font-mono text-muted">
                <div>Mobile Opt: <span className={cn(isMobile ? "text-cyan-400 font-bold" : "text-muted")}>{isMobile ? "ON (2GB)" : "OFF"}</span></div>
                <div>Stems Mapped: <span className="text-foreground">{stems.length}</span></div>
              </div>
            </div>

            <div className="absolute bottom-4 right-4 p-2 bg-black-deep/80 backdrop-blur border border-foreground/10 rounded-lg pointer-events-none text-right">
              <span className="text-[10px] text-muted flex items-center gap-1.5 justify-end">
                <HelpCircle size={11} className="text-[var(--logo-gradient-start)]" />
                Rotate: Drag screen | Teleport: Double-tap seat
              </span>
            </div>
          </>
        )}
      </div>

      {isEntireScreen && (
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-50 pointer-events-none text-xs font-mono text-muted p-2 bg-black/75 backdrop-blur-md rounded-xl border border-white/10 max-w-sm sm:max-w-md mx-auto">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[9px] uppercase tracking-widest text-[#93c5fd] font-bold">Nefron Stem Output:</span>
            {stems.map(s => (
              <span key={s.id} className="flex items-center gap-1 text-[10px] whitespace-nowrap shrink-0" style={{ color: s.color }}>
                <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: s.color }} />
                {s.name}:{s.value}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
