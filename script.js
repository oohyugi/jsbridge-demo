
const REMOTE = {
  video: "https://www.w3schools.com/html/mov_bbb.mp4",
  image: "https://www.w3schools.com/html/img_girl.jpg",
  pdf: "https://pdfobject.com/pdf/sample.pdf",
  audio: "https://www.w3schools.com/html/horse.mp3"
};

const LOCAL = {
  video: "http://127.0.0.1:8080/video/video1",
  image: "http://127.0.0.1:8080/image/img1",
  pdf: "http://127.0.0.1:8080/pdf/pdf1",
  audio: "http://127.0.0.1:8080/audio/audio1"
};

/* =========================
   PLATFORM DETECTION
========================= */
function isMobileApp() {
  return !!(
    window.flutter_inappwebview ||
    window.Android ||
    (window.webkit && window.webkit.messageHandlers)
  );
}

/* =========================
   SOURCE SWITCHER
========================= */
function setSources(isOffline) {
  document.getElementById("videoPlayer").src = isOffline ? LOCAL.video : REMOTE.video;
  document.getElementById("imageContent").src = isOffline ? LOCAL.image : REMOTE.image;
  document.getElementById("pdfContent").src = isOffline ? LOCAL.pdf : REMOTE.pdf;
  document.getElementById("audioPlayer").src = isOffline ? LOCAL.audio : REMOTE.audio;
}

async function checkLocalServer() {
  try {
    const res = await fetch(LOCAL.video, { method: "HEAD" });
    if (res.ok) {
      log("✓ LOCAL MODE");
      setSources(true);
      return;
    }
  } catch (_) {
    log("✓ REMOTE MODE");
  }
  setSources(false);
}

/* =========================
   LOGGER
========================= */
function log(...args) {
  const el = document.getElementById("log");
  const timestamp = new Date().toLocaleTimeString();
  const message = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  el.textContent += `[${timestamp}] ${message}\n`;
  el.scrollTop = el.scrollHeight;
}

/* =========================
   GENERIC JSBRIDGE CALLER
========================= */
async function callJsBridge(handlerName, ...args) {
  // Flutter InAppWebView
  if (window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === "function") {
    try {
      const res = await window.flutter_inappwebview.callHandler(handlerName, ...args);
      log(`✓ [Flutter] ${handlerName} success`);
      return res;
    } catch (e) {
      log(`✗ [Flutter] ${handlerName} error:`, e.message || e);
      throw e;
    }
  }

  // Android Interface
  if (window.Android && typeof window.Android[handlerName] === "function") {
    try {
      const res = window.Android[handlerName](...args);
      log(`✓ [Android] ${handlerName} called`);
      return res;
    } catch (e) {
      log(`✗ [Android] ${handlerName} error:`, e.message || e);
      throw e;
    }
  }

  // iOS WKWebView
  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers[handlerName]) {
    try {
      window.webkit.messageHandlers[handlerName].postMessage(args[0] ?? null);
      log(`✓ [iOS] ${handlerName} posted`);
      return null;
    } catch (e) {
      log(`✗ [iOS] ${handlerName} error:`, e.message || e);
      throw e;
    }
  }

  throw new Error("no_bridge");
}

/* =========================
   DOWNLOAD - MOBILE vs WEB
========================= */
function downloadMedia(id, type, url) {
  if (isMobileApp()) {
    // Mobile: gunakan JSBridge
    if (window.flutter_inappwebview) {
      window.flutter_inappwebview.callHandler("downloadContent", { id, type, url })
        .then(() => log(`✓ Download ${type} via JSBridge`))
        .catch(e => log(`✗ Download error:`, e.message));
    } else {
      log("✗ JSBridge tidak tersedia");
    }
  } else {
    // Web: gunakan download link
    log(`↓ Downloading ${type} (web mode)...`);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.${type}`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    log(`✓ Download started: ${url}`);
  }
}

/* =========================
   BACK TO APP
========================= */
document.getElementById("btnBack").addEventListener("click", () => {
  if (isMobileApp()) {
    callJsBridge("backToApp").catch(() => {
      log("✗ backToApp failed, using fallback");
      history.back();
    });
  } else {
    log("↩ Web mode: history.back()");
    history.back();
  }
});

/* =========================
   COPY TEXT
========================= */
document.getElementById("btnCopy").addEventListener("click", async () => {
  const text = document.getElementById("copyInput").value || "";

  if (isMobileApp()) {
    // Mobile: coba JSBridge dulu, fallback ke clipboard API
    try {
      await callJsBridge("copyText", text);
      log("✓ Text copied via JSBridge");
    } catch (_) {
      try {
        await navigator.clipboard.writeText(text);
        log("✓ Text copied via Clipboard API (fallback)");
      } catch (err) {
        log("✗ Copy failed:", err.message || err);
      }
    }
  } else {
    // Web: langsung gunakan clipboard API
    try {
      await navigator.clipboard.writeText(text);
      log("✓ Text copied to clipboard");
    } catch (err) {
      log("✗ Copy failed:", err.message || err);
    }
  }
});

/* =========================
   SHARE
========================= */
document.getElementById("btnShare").addEventListener("click", async () => {
  const text = document.getElementById("copyInput").value || "";

  if (isMobileApp()) {
    // Mobile: coba JSBridge dulu
    try {
      await callJsBridge("shareText", text);
      log("✓ Shared via JSBridge");
    } catch (e) {
      log("✗ JSBridge share not available, trying Web Share API");
      if (navigator.share) {
        try {
          await navigator.share({ text });
          log("✓ Shared via Web Share API");
        } catch (err) {
          log("✗ Share failed:", err.message || err);
        }
      } else {
        log("✗ Web Share API not available");
      }
    }
  } else {
    // Web: gunakan Web Share API jika tersedia
    if (navigator.share) {
      try {
        await navigator.share({ text });
        log("✓ Shared via Web Share API");
      } catch (err) {
        log("✗ Share cancelled or failed");
      }
    } else {
      log("✗ Web Share API not supported in this browser");
    }
  }
});

/* =========================
   NATIVE LOGGER
========================= */
window.__nativeLog = function (msg) {
  log("[NATIVE]", msg);
};

/* =========================
   INIT
========================= */
function init() {
  const platformBadge = document.getElementById("platformBadge");
  
  if (isMobileApp()) {
    platformBadge.innerHTML = '<span class="badge mobile">📱 Mobile App</span>';
    log("🚀 Running in Mobile App");
  } else {
    platformBadge.innerHTML = '<span class="badge web">🌐 Web Browser</span>';
    log("🚀 Running in Web Browser");
  }

  checkLocalServer();
  log("✓ Ready");
}

init();