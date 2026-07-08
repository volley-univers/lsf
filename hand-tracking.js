// hand-tracking.js
// Enveloppe autour de MediaPipe Tasks Vision (HandLandmarker).
// Tout le traitement se fait localement dans le navigateur : aucune image
// n'est envoyée à un serveur.

import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

let handLandmarker = null;
let running = false;
let videoEl, canvasEl, ctx;
let onResult = () => {};

async function initLandmarker(){
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 1,
  });
}

async function startCamera(video, canvas, callback){
  videoEl = video;
  canvasEl = canvas;
  ctx = canvasEl.getContext("2d");
  onResult = callback;

  if(!handLandmarker){
    await initLandmarker();
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
    audio: false,
  });
  videoEl.srcObject = stream;

  await new Promise((resolve) => {
    videoEl.onloadedmetadata = () => resolve();
  });
  videoEl.play();

  canvasEl.width = videoEl.videoWidth || 640;
  canvasEl.height = videoEl.videoHeight || 480;

  running = true;
  requestAnimationFrame(loop);
}

function stopCamera(){
  running = false;
  if(videoEl && videoEl.srcObject){
    videoEl.srcObject.getTracks().forEach(t => t.stop());
    videoEl.srcObject = null;
  }
}

function loop(){
  if(!running) return;
  if(videoEl.readyState >= 2){
    const nowMs = performance.now();
    const result = handLandmarker.detectForVideo(videoEl, nowMs);
    draw(result);
    onResult(result);
  }
  requestAnimationFrame(loop);
}

function draw(result){
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  if(!result.landmarks || result.landmarks.length === 0) return;

  const landmarks = result.landmarks[0];
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(255,111,89,0.85)";
  HAND_CONNECTIONS.forEach(([a, b]) => {
    const p1 = landmarks[a], p2 = landmarks[b];
    ctx.beginPath();
    ctx.moveTo(p1.x * canvasEl.width, p1.y * canvasEl.height);
    ctx.lineTo(p2.x * canvasEl.width, p2.y * canvasEl.height);
    ctx.stroke();
  });
  ctx.fillStyle = "#ffb62e";
  landmarks.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x * canvasEl.width, p.y * canvasEl.height, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

window.HandTracking = { startCamera, stopCamera };
