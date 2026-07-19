const $ = (selector) => document.querySelector(selector);

const els = {
  file: $("#media-file"), drop: $("#drop-zone"), error: $("#error"), workspace: $("#workspace"),
  stage: $("#stage"), image: $("#image-preview"), video: $("#video-preview"), details: $("#media-details"),
  profile: $("#device-profile"), fit: $("#fit"), glass: $("#glass"), shadow: $("#shadow"),
  background: $("#background"), colorValue: $("#color-value"), aspectNote: $("#aspect-note"),
  export: $("#export"), replace: $("#replace"), note: $("#export-note"), progressPanel: $("#progress-panel"),
  progress: $("#progress"), progressStatus: $("#progress-status"), cancel: $("#cancel"), result: $("#result"),
  imageResult: $("#image-result"), videoResult: $("#video-result"), resultDetails: $("#result-details"),
  download: $("#download"), editAgain: $("#edit-again"), canvas: $("#render-canvas"),
};

const PROFILES = {
  "pixel-10-pro": {
    label: "Pixel 10 Pro", className: "phone portrait pixel-10-pro", width: 1080, height: 2160,
    device: { x: 120, y: 180, w: 840, h: 1800, radius: 104 },
    screen: { x: 158, y: 228, w: 764, h: 1704, radius: 52 }, camera: "hole",
  },
  "iphone-16-pro": {
    label: "iPhone 16 Pro", className: "phone portrait iphone-16-pro", width: 1080, height: 2160,
    device: { x: 120, y: 180, w: 840, h: 1800, radius: 126 },
    screen: { x: 157, y: 248, w: 766, h: 1665, radius: 68 }, camera: "island",
  },
  "galaxy-s25-ultra": {
    label: "Galaxy S25 Ultra", className: "phone portrait galaxy-s25-ultra", width: 1080, height: 2160,
    device: { x: 110, y: 140, w: 860, h: 1880, radius: 66 },
    screen: { x: 145, y: 224, w: 790, h: 1712, radius: 28 }, camera: "hole",
  },
  "pixel-tablet": {
    label: "Pixel Tablet", className: "tablet landscape pixel-tablet", width: 1920, height: 1300,
    device: { x: 110, y: 90, w: 1700, h: 1120, radius: 72 },
    screen: { x: 192, y: 170, w: 1536, h: 960, radius: 28 }, camera: "tablet",
  },
  browser: {
    label: "Desktop browser", className: "browser landscape", width: 1600, height: 1000,
    device: { x: 50, y: 45, w: 1500, h: 910, radius: 45 },
    screen: { x: 75, y: 145, w: 1450, h: 785, radius: 12 }, camera: "browser",
  },
  "generic-landscape": {
    label: "Generic landscape phone", className: "phone landscape generic-landscape", width: 1920, height: 1080,
    device: { x: 45, y: 125, w: 1830, h: 830, radius: 105 },
    screen: { x: 180, y: 170, w: 1560, h: 740, radius: 36 }, camera: "landscape",
  },
};

let file = null;
let sourceUrl = "";
let resultUrl = "";
let kind = "";
let cancelled = false;
let activeRecorder = null;

const state = () => ({
  profile: PROFILES[els.profile.value], fit: els.fit.value, background: els.background.value,
  glass: els.glass.checked, shadow: els.shadow.checked,
});
const setError = (message = "") => { els.error.textContent = message; els.error.hidden = !message; };
const formatSize = (bytes) => `${(bytes / 1024 / 1024).toFixed(bytes > 10_000_000 ? 0 : 1)} MB`;
const sourceDimensions = () => kind === "image"
  ? { width: els.image.naturalWidth, height: els.image.naturalHeight }
  : { width: els.video.videoWidth, height: els.video.videoHeight };

function updateAspectNote() {
  const { profile, fit } = state();
  const source = sourceDimensions();
  if (!source.width || !source.height) return;
  const sourceRatio = source.width / source.height;
  const screenRatio = profile.screen.w / profile.screen.h;
  const difference = Math.abs(sourceRatio - screenRatio) / screenRatio;
  if (difference <= 0.03) {
    els.aspectNote.textContent = `Excellent fit: this source is within ${Math.round(difference * 100)}% of the ${profile.label} screen.`;
  } else if (fit === "contain") {
    els.aspectNote.textContent = `Aspect ratios differ by ${Math.round(difference * 100)}%. “Fit entire screen” keeps every pixel and adds discreet letterboxing.`;
  } else {
    els.aspectNote.textContent = `Aspect ratios differ by ${Math.round(difference * 100)}%. “Fill and crop” trims the edges to stay behind the glass.`;
  }
}

function updateStage() {
  const current = state();
  els.stage.className = `stage ${current.profile.className}${current.glass ? " has-glass" : ""}${current.shadow ? " has-shadow" : ""}`;
  els.stage.style.backgroundColor = current.background;
  els.colorValue.textContent = current.background;
  const media = kind === "image" ? els.image : els.video;
  media.style.objectFit = current.fit;
  updateAspectNote();
}

async function loadFile(nextFile) {
  setError();
  if (!nextFile) return;
  const isImage = nextFile.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(nextFile.name);
  const isVideo = nextFile.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/i.test(nextFile.name);
  if (!isImage && !isVideo) { setError("Choose an image or video file that your browser can decode."); return; }
  file = nextFile;
  kind = isImage ? "image" : "video";
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = URL.createObjectURL(file);
  els.image.hidden = kind !== "image";
  els.video.hidden = kind !== "video";
  els.imageResult.hidden = true;
  els.videoResult.hidden = true;
  els.result.hidden = true;
  try {
    if (kind === "image") {
      await new Promise((resolve, reject) => {
        els.image.onload = resolve;
        els.image.onerror = () => reject(new Error("This image could not be decoded."));
        els.image.src = sourceUrl;
      });
      els.details.textContent = `${els.image.naturalWidth}×${els.image.naturalHeight} · ${formatSize(file.size)}`;
      els.export.textContent = "Export premium PNG";
      els.note.textContent = "The exported PNG includes the selected bezel, depth, and optional glass treatment.";
    } else {
      await new Promise((resolve, reject) => {
        els.video.onloadedmetadata = resolve;
        els.video.onerror = () => reject(new Error("This video format is not playable in this browser."));
        els.video.src = sourceUrl;
      });
      els.details.textContent = `${els.video.videoWidth}×${els.video.videoHeight} · ${formatSize(file.size)}`;
      els.export.textContent = "Export framed WebM";
      els.note.textContent = "Video export plays and records the full composition in real time. Keep this tab visible.";
    }
    const dimensions = sourceDimensions();
    if (dimensions.width / dimensions.height > 1.2 && !["pixel-tablet", "browser", "generic-landscape"].includes(els.profile.value)) {
      els.profile.value = "generic-landscape";
    }
    els.workspace.hidden = false;
    updateStage();
    els.workspace.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  } catch (error) {
    els.workspace.hidden = true;
    setError(error.message);
  }
}

function roundedRect(ctx, rect, radius, operation = null) {
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
  if (operation) ctx[operation]();
}

function drawMedia(ctx, media, screen, fit) {
  const source = sourceDimensions();
  if (!source.width || !source.height) return;
  const scale = fit === "cover"
    ? Math.max(screen.w / source.width, screen.h / source.height)
    : Math.min(screen.w / source.width, screen.h / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  ctx.save();
  roundedRect(ctx, screen, screen.radius);
  ctx.clip();
  ctx.fillStyle = "#050608";
  ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
  ctx.drawImage(media, screen.x + (screen.w - width) / 2, screen.y + (screen.h - height) / 2, width, height);
  ctx.restore();
}

function drawGlass(ctx, screen) {
  ctx.save();
  roundedRect(ctx, screen, screen.radius);
  ctx.clip();
  const gradient = ctx.createLinearGradient(screen.x, screen.y, screen.x + screen.w, screen.y + screen.h);
  gradient.addColorStop(0, "rgba(255,255,255,.24)");
  gradient.addColorStop(0.11, "rgba(255,255,255,.08)");
  gradient.addColorStop(0.3, "rgba(255,255,255,.015)");
  gradient.addColorStop(0.68, "rgba(255,255,255,.035)");
  gradient.addColorStop(0.84, "rgba(255,255,255,.13)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
  ctx.restore();
}

function drawHardware(ctx, profile) {
  const { device, screen, camera } = profile;
  ctx.fillStyle = "#050608";
  if (camera === "browser") {
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = ["#ff625f", "#ffcc4d", "#62dfa1"][i];
      ctx.beginPath(); ctx.arc(device.x + 55 + i * 38, device.y + 45, 12, 0, Math.PI * 2); ctx.fill();
    }
  } else if (camera === "island") {
    roundedRect(ctx, { x: screen.x + screen.w / 2 - 92, y: screen.y + 22, w: 184, h: 48 }, 26, "fill");
  } else if (camera === "landscape") {
    ctx.beginPath(); ctx.arc(screen.x + 22, screen.y + screen.h / 2, 13, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(screen.x + screen.w / 2, screen.y + 22, camera === "tablet" ? 10 : 13, 0, Math.PI * 2); ctx.fill();
  }
}

function renderFrame() {
  const current = state();
  const profile = current.profile;
  const ctx = els.canvas.getContext("2d");
  els.canvas.width = profile.width;
  els.canvas.height = profile.height;
  ctx.fillStyle = current.background;
  ctx.fillRect(0, 0, profile.width, profile.height);

  ctx.save();
  if (current.shadow) {
    ctx.shadowColor = "rgba(18,15,12,.34)";
    ctx.shadowBlur = Math.round(profile.width * 0.035);
    ctx.shadowOffsetY = Math.round(profile.width * 0.022);
  }
  ctx.fillStyle = profile.camera === "browser" ? "#d9dade" : "#111318";
  roundedRect(ctx, profile.device, profile.device.radius, "fill");
  ctx.restore();

  if (profile.camera === "browser") {
    ctx.fillStyle = "#c7c9cc";
    ctx.fillRect(profile.device.x + 20, profile.device.y + 96, profile.device.w - 40, 3);
  }
  drawMedia(ctx, kind === "image" ? els.image : els.video, profile.screen, current.fit);
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = Math.max(2, Math.round(profile.width * 0.003));
  roundedRect(ctx, profile.screen, profile.screen.radius, "stroke");
  if (current.glass) drawGlass(ctx, profile.screen);
  drawHardware(ctx, profile);
  return profile;
}

async function exportImage() {
  const profile = renderFrame();
  const blob = await new Promise((resolve) => els.canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The browser could not encode the PNG.");
  showResult(blob, "image/png", profile);
}

const recorderMime = () => ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
  .find((type) => MediaRecorder.isTypeSupported(type)) || "";

async function exportVideo() {
  if (!els.canvas.captureStream || !window.MediaRecorder) throw new Error("Framed video export needs current Chrome, Edge, or Firefox on desktop.");
  cancelled = false;
  els.progressPanel.hidden = false;
  els.result.hidden = true;
  els.progress.value = 0;
  els.video.pause();
  els.video.currentTime = 0;
  await new Promise((resolve) => els.video.addEventListener("seeked", resolve, { once: true }));
  const profile = renderFrame();
  const canvasStream = els.canvas.captureStream(30);
  const sourceCapture = (els.video.captureStream || els.video.mozCaptureStream)?.call(els.video);
  const audioTracks = sourceCapture?.getAudioTracks() || [];
  audioTracks.forEach((track) => canvasStream.addTrack(track));
  const recorder = new MediaRecorder(canvasStream, recorderMime() ? { mimeType: recorderMime() } : undefined);
  activeRecorder = recorder;
  const chunks = [];
  recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
  const done = new Promise((resolve, reject) => {
    recorder.onstop = resolve;
    recorder.onerror = () => reject(recorder.error || new Error("Video recording failed."));
  });
  recorder.start(500);
  els.video.muted = true;
  await els.video.play();
  els.progressStatus.textContent = audioTracks.length
    ? "Rendering the premium frame and source audio in real time…"
    : "Rendering the premium frame in real time… The source has no audio track.";
  await new Promise((resolve) => {
    const tick = () => {
      renderFrame();
      els.progress.value = els.video.duration ? els.video.currentTime / els.video.duration * 100 : 0;
      els.progress.textContent = `${Math.round(els.progress.value)}%`;
      if (cancelled || els.video.ended) resolve(); else requestAnimationFrame(tick);
    };
    tick();
  });
  els.video.pause();
  els.video.muted = false;
  if (recorder.state !== "inactive") recorder.stop();
  await done;
  canvasStream.getTracks().forEach((track) => track.stop());
  els.progressPanel.hidden = true;
  activeRecorder = null;
  if (cancelled) return;
  if (!chunks.length) throw new Error("No framed video data was produced.");
  showResult(new Blob(chunks, { type: recorder.mimeType || "video/webm" }), "video/webm", profile);
}

function showResult(blob, type, profile) {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = URL.createObjectURL(blob);
  const isVideo = type.startsWith("video");
  els.imageResult.hidden = isVideo;
  els.videoResult.hidden = !isVideo;
  if (isVideo) {
    els.videoResult.onloadedmetadata = () => {
      if (!Number.isFinite(els.videoResult.duration)) {
        els.videoResult.ontimeupdate = () => { els.videoResult.ontimeupdate = null; els.videoResult.currentTime = 0; };
        els.videoResult.currentTime = 1e101;
      }
    };
    els.videoResult.src = resultUrl;
  } else {
    els.imageResult.src = resultUrl;
  }
  els.download.href = resultUrl;
  els.download.download = `${els.profile.value}-device-frame-${Date.now()}.${isVideo ? "webm" : "png"}`;
  els.resultDetails.textContent = `${profile.label} · ${profile.width}×${profile.height} · ${formatSize(blob.size)}`;
  els.result.hidden = false;
  els.result.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function runExport() {
  setError();
  els.export.disabled = true;
  try { if (kind === "image") await exportImage(); else await exportVideo(); }
  catch (error) { els.progressPanel.hidden = true; setError(`Couldn’t export: ${error.message}`); }
  finally { els.export.disabled = false; activeRecorder = null; }
}

els.file.addEventListener("change", () => loadFile(els.file.files[0]));
for (const event of ["dragenter", "dragover"]) els.drop.addEventListener(event, (e) => { e.preventDefault(); els.drop.classList.add("is-dragging"); });
for (const event of ["dragleave", "drop"]) els.drop.addEventListener(event, (e) => { e.preventDefault(); els.drop.classList.remove("is-dragging"); });
els.drop.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));
for (const control of [els.profile, els.fit, els.glass, els.shadow, els.background]) control.addEventListener("input", updateStage);
els.export.addEventListener("click", runExport);
els.replace.addEventListener("click", () => els.file.click());
els.cancel.addEventListener("click", () => {
  cancelled = true;
  els.video.pause();
  if (activeRecorder?.state !== "inactive") activeRecorder.stop();
});
els.editAgain.addEventListener("click", () => { els.result.hidden = true; els.workspace.scrollIntoView({ block: "start" }); });
window.addEventListener("beforeunload", () => {
  if (activeRecorder?.state !== "inactive") activeRecorder.stop();
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  if (resultUrl) URL.revokeObjectURL(resultUrl);
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
