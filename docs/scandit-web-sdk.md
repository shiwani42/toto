# Scandit Data Capture SDK — Web Framework Documentation

> Compiled from <https://docs.scandit.com/?framework=web> (version **7.6.14**, current stable line at compile time).
> Source pages are linked next to every section so you can jump to the canonical docs.

---

## Table of Contents

1. [Quick Reference](#1-quick-reference)
   - 1.1 [Package map](#11-package-map)
   - 1.2 [Versions](#12-versions)
   - 1.3 [Glossary of core types](#13-glossary-of-core-types)
2. [Installation & Setup](#2-installation--setup)
   - 2.1 [Prerequisites](#21-prerequisites)
   - 2.2 [npm installation](#22-npm-installation)
   - 2.3 [CDN installation](#23-cdn-installation)
   - 2.4 [The `configure()` call](#24-the-configure-call)
   - 2.5 [Hosting the WebAssembly / `sdc-lib` files](#25-hosting-the-webassembly--sdc-lib-files)
   - 2.6 [Loading status UI](#26-loading-status-ui)
   - 2.7 [Framework integration (Next.js, Gatsby, PWA, Electron)](#27-framework-integration-nextjs-gatsby-pwa-electron)
   - 2.8 [Complete CDN example](#28-complete-cdn-example)
3. [Core Concepts](#3-core-concepts)
   - 3.1 [DataCaptureContext](#31-datacapturecontext)
   - 3.2 [DataCaptureView](#32-datacaptureview)
   - 3.3 [Camera & FrameSource](#33-camera--framesource)
   - 3.4 [Modes and listeners](#34-modes-and-listeners)
4. [Single Scanning](#4-single-scanning)
5. [Batch Scanning (MatrixScan family)](#5-batch-scanning-matrixscan-family)
6. [Barcode Capture (low-level API)](#6-barcode-capture-low-level-api)
   - 6.1 [Setup](#61-setup)
   - 6.2 [Rejecting barcodes](#62-rejecting-barcodes)
   - 6.3 [Enable / disable](#63-enable--disable)
7. [Symbologies](#7-symbologies)
   - 7.1 [Enabling symbologies](#71-enabling-symbologies)
   - 7.2 [Industry presets](#72-industry-presets)
   - 7.3 [Active symbol counts](#73-active-symbol-counts)
   - 7.4 [Color-inverted barcodes](#74-color-inverted-barcodes)
   - 7.5 [Checksum enforcement](#75-checksum-enforcement)
   - 7.6 [Symbology extensions](#76-symbology-extensions)
8. [SparkScan](#8-sparkscan)
   - 8.1 [Overview & modes](#81-overview--modes)
   - 8.2 [Setup](#82-setup)
   - 8.3 [Advanced (feedback delegate, custom trigger, toolbar)](#83-advanced-feedback-delegate-custom-trigger-toolbar)
9. [MatrixScan Batch (BarcodeBatch)](#9-matrixscan-batch-barcodebatch)
10. [MatrixScan Find (BarcodeFind)](#10-matrixscan-find-barcodefind)
    - 10.1 [Overview](#101-overview)
    - 10.2 [Setup](#102-setup)
    - 10.3 [Listener events](#103-listener-events)
    - 10.4 [UI customization](#104-ui-customization)
11. [MatrixScan Count](#11-matrixscan-count)
12. [MatrixScan Pick](#12-matrixscan-pick)
13. [ID Capture & Validation](#13-id-capture--validation)
    - 13.1 [Overview](#131-overview)
    - 13.2 [Required modules](#132-required-modules)
    - 13.3 [Setup walkthrough](#133-setup-walkthrough)
    - 13.4 [Rejection reasons](#134-rejection-reasons)
    - 13.5 [Anonymization](#135-anonymization)
    - 13.6 [ID images](#136-id-images)
    - 13.7 [Fake-ID detection (ID Validate)](#137-fake-id-detection-id-validate)
14. [Parser](#14-parser)
15. [Release Notes (7.0 → 7.6.14)](#15-release-notes-70--7614)
16. [Pages unavailable in 7.6.14 Web](#16-pages-unavailable-in-7614-web)
17. [Open-Source Apps, Samples & Tooling (GitHub)](#17-open-source-apps-samples--tooling-github)
    - 17.1 [Web sample apps](#171-web-sample-apps)
    - 17.2 [Scandit Skills (AI coding-agent integration)](#172-scandit-skills-ai-coding-agent-integration)
    - 17.3 [Cross-platform sample repos](#173-cross-platform-sample-repos)
    - 17.4 [Frameworks & infrastructure repos](#174-frameworks--infrastructure-repos)
    - 17.5 [How to run a Web sample locally](#175-how-to-run-a-web-sample-locally)
18. [Useful Links](#18-useful-links)

---

## 1. Quick Reference

### 1.1 Package map

All Scandit web packages live under the `@scandit/` npm scope (renamed in 7.0 — older code that used `scandit-web-datacapture-*` should be updated).

| Package | Purpose |
| --- | --- |
| `@scandit/web-datacapture-core` | Required base — context, view, camera, configuration |
| `@scandit/web-datacapture-barcode` | Barcode capture, SparkScan, MatrixScan, BarcodeBatch, BarcodeFind, BarcodePick |
| `@scandit/web-datacapture-id` | ID Capture / ID Validate |
| `@scandit/web-datacapture-parser` | Standalone parser (GS1, HIBC, AAMVA, MRZ, SwissQR, VIN, IATA BCBP) |

### 1.2 Versions

- **8.4.0** — current stable (different package versions; see migration guide)
- **7.6.14** — covered by this document (most recent 7.x at compile time)
- **6.28.10** — legacy

### 1.3 Glossary of core types

- **`DataCaptureContext`** — the conductor; every capture mode attaches to a context.
- **`DataCaptureView`** — DOM element wrapper that visualizes camera output and overlays.
- **`Camera` / `FrameSource`** — frame producers; `Camera.default` returns the preferred device camera.
- **Mode** — a capture mode (e.g. `BarcodeCapture`, `BarcodeBatch`, `SparkScan`, `IdCapture`). Only one mode is active per context at a time.
- **Listener** — interface attached to a mode to receive scan events.
- **Overlay** — UI layer drawn on top of `DataCaptureView` (e.g. `BarcodeCaptureOverlay`, `IdCaptureOverlay`).
- **`Symbology`** — enum of supported barcode formats.

---

## 2. Installation & Setup

Canonical page: <https://docs.scandit.com/7.6.14/sdks/web/add-sdk/>

### 2.1 Prerequisites

- Latest stable **Node.js** and **npm** (if bundling the SDK).
- A valid **Scandit Data Capture SDK license key** (free trial available).
- Browser support for **WebGL** and **OffscreenCanvas**.
- A GPU-capable device for best performance.
- Camera permission only works in **secure contexts** (HTTPS).

### 2.2 npm installation

```bash
npm install --save @scandit/web-datacapture-core @scandit/web-datacapture-barcode
```

Pin a version with:

```bash
npm install --save @scandit/web-datacapture-core@<version>
```

Named imports:

```javascript
import {
  DataCaptureContext,
  Camera,
  configure,
} from "@scandit/web-datacapture-core";
import {
  BarcodeCapture,
  barcodeCaptureLoader,
} from "@scandit/web-datacapture-barcode";
```

Or namespaced:

```javascript
import * as SDCCore from "@scandit/web-datacapture-core";
import * as SDCBarcode from "@scandit/web-datacapture-barcode";
```

### 2.3 CDN installation

```html
<link rel="modulepreload"
      href="https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-core@7/build/js/index.js"/>
<link rel="modulepreload"
      href="https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7/build/js/index.js"/>

<script async
        src="https://ga.jspm.io/npm:es-module-shims@1.10.0/dist/es-module-shims.js"></script>

<script type="importmap">
  {
    "imports": {
      "@scandit/web-datacapture-core":
        "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-core@7/build/js/index.js",
      "@scandit/web-datacapture-barcode":
        "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7/build/js/index.js",
      "@scandit/web-datacapture-barcode/":
        "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7/",
      "@scandit/web-datacapture-core/":
        "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-core@7/"
    }
  }
</script>
```

UNPKG also works as a drop-in alternative.

### 2.4 The `configure()` call

`configure()` must be awaited **once**, early in the application lifecycle, before any mode is created:

```javascript
import {
  configure,
  DataCaptureView,
  DataCaptureContext,
} from "@scandit/web-datacapture-core";
import { barcodeCaptureLoader } from "@scandit/web-datacapture-barcode";

const view = new DataCaptureView();
view.connectToElement(document.getElementById("data-capture-view"));
view.showProgressBar();
view.setProgressBarMessage("Loading ...");

await configure({
  licenseKey: "-- ENTER YOUR SCANDIT LICENSE KEY HERE --",
  libraryLocation: "/self-hosted-sdc-lib/",
  moduleLoaders: [barcodeCaptureLoader()],
});

view.hideProgressBar();
const context = await DataCaptureContext.create();
await view.setContext(context);
```

Key options:

- `licenseKey` — required.
- `libraryLocation` — points to the `sdc-lib` folder containing the WASM and `.model` files. When using CDN imports, point it at `https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7/sdc-lib/`.
- `moduleLoaders` — loaders for each feature module (e.g. `barcodeCaptureLoader()`, `idCaptureLoader({ enableVIZDocuments: true })`, `parserLoader()`).

> The library version and external files version **must match**.

### 2.5 Hosting the WebAssembly / `sdc-lib` files

External files must be served with correct MIME types. Snippets:

**ASP.NET Core:**

```csharp
app.UseStaticFiles(new StaticFileOptions(){
  ServeUnknownFileTypes = true,
  DefaultContentType = "application/octet-stream"
});

var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
provider.Mappings[".model"] = "application/octet-stream";
provider.Mappings[".js"]    = "application/javascript";
provider.Mappings[".wasm"]  = "application/wasm";
```

**Apache (`.htaccess`):**

```apache
AddType application/wasm .wasm
AddType application/octet-stream .model
AddType application/javascript .js
```

**Nginx:**

```nginx
types {
  application/wasm wasm;
  application/octet-stream model;
  application/javascript js;
}
```

**Express:**

```javascript
const express = require("express");
const app = express();
express.static.mime.define({ "application/wasm": ["wasm"] });
express.static.mime.define({ "application/octet-stream": ["model"] });
express.static.mime.define({ "application/javascript": ["js"] });
app.use(express.static("self-hosted-sdc-lib"));
```

**Flask:**

```python
from flask import Flask, send_file
app = Flask(__name__)

@app.route('/self-hosted-sdc-lib/<path:filename>')
def serve_file(filename):
    mimetype = None
    if filename.endswith('.wasm'):
        mimetype = 'application/wasm'
    elif filename.endswith('.model'):
        mimetype = 'application/octet-stream'
    elif filename.endswith('.js'):
        mimetype = 'application/javascript'
    return send_file(f'/self-hosted-sdc-lib/{filename}', mimetype=mimetype)
```

### 2.6 Loading status UI

Use the built-in progress bar:

```javascript
const view = new DataCaptureView();
view.connectToElement(document.getElementById("data-capture-view"));
view.showProgressBar();

await configure({
  licenseKey: "SCANDIT_LICENSE_KEY",
  libraryLocation: "/self-hosted-sdc-lib/",
  moduleLoaders: [barcodeCaptureLoader()],
});

view.hideProgressBar();
```

Or build your own with the loading-status observable:

```javascript
import { configure, loadingStatus } from "@scandit/web-datacapture-core";

loadingStatus.subscribe((info) => {
  // updateUI(info.percentage, info.loadedBytes)
});

await configure({ /* ... */ });
```

> Files must be served with `Content-Length` and `Content-Encoding` headers for accurate progress.

### 2.7 Framework integration (Next.js, Gatsby, PWA, Electron)

**Server-side rendering** — disable SSR for SDK code:
- Gatsby: client-side-only packages.
- Next.js: lazy load with `{ ssr: false }`.

**Progressive Web Apps (Workbox):**

```javascript
workbox: {
  globPatterns: ["**/*.{css,html,ico,png,svg,woff2}", "**/*.{wasm,js}"],
  maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  runtimeCaching: [
    {
      urlPattern: /^.*\.wasm(\?.*)?$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'wasm-version-cache',
        expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
        matchOptions: { ignoreSearch: false },
      },
    },
  ],
}
```

> Note: iOS PWAs have documented issues accessing video streams.

**Electron** — Main process:

```typescript
import { register, unregister } from '@scandit/web-datacapture-core/build/electron/main';
import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

const mainWindow = new BrowserWindow({ /* ... */ });
register({ fs, ipcMain, app, path, crypto }, publicKey);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { app.quit(); unregister(); }
});
```

Preload:

```typescript
import { ipcRenderer } from "electron";
import { preloadBindings } from "@scandit/web-datacapture-core/build/electron/preload";
preloadBindings(ipcRenderer);
```

Renderer:

```typescript
await configure({
  licenseDataPath: "./out/renderer/data/sdc-license.data",
  libraryLocation: new URL("self-hosted-sdc-lib", document.baseURI).toString(),
  moduleLoaders: [barcodeCaptureLoader()],
});
```

License encryption helper:

```javascript
const crypto = require("node:crypto");
const fs = require("node:fs/promises");

(async function createLicenseAndPublicKey() {
  const licenseText = process.env.SDC_LICENSE_KEY;
  if (!licenseText) throw new Error("could not encrypt empty or null string");
  const key = crypto.randomBytes(32);
  const iv  = crypto.randomBytes(16);
  const keyAndIV = `${key.toString("base64")}:${iv.toString("base64")}`;
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let licenseEncryptedText = cipher.update(licenseText, "utf8", "hex");
  licenseEncryptedText += cipher.final("hex");
  await fs.writeFile("sdc-license.data", Buffer.from(licenseEncryptedText), "utf8");
  await fs.writeFile("sdc-public-key", keyAndIV, "utf8");
})();
```

> Security: don't ship the public key locally; protect source with `bytenode` or similar.

### 2.8 Complete CDN example

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Scandit CDN Simple sample</title>
    <script type="importmap">
      {
        "imports": {
          "@scandit/web-datacapture-core":    "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-core@7/build/js/index.js",
          "@scandit/web-datacapture-barcode": "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7/build/js/index.js",
          "@scandit/web-datacapture-barcode/":"https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7/",
          "@scandit/web-datacapture-core/":   "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-core@7/"
        }
      }
    </script>
    <link rel="modulepreload" href="https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-core@7/build/js/index.js" />
    <link rel="modulepreload" href="https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7/build/js/index.js" />
    <style>html, body { margin:0; padding:0; height:100%; } #app { height:100%; }</style>
    <script async src="https://ga.jspm.io/npm:es-module-shims@1.10.0/dist/es-module-shims.js"></script>
    <script type="module">
      import {
        configure, DataCaptureView, Camera, DataCaptureContext, FrameSourceState,
      } from "@scandit/web-datacapture-core";
      import {
        barcodeCaptureLoader, BarcodeCaptureSettings, BarcodeCapture, Symbology, SymbologyDescription,
      } from "@scandit/web-datacapture-barcode";

      const view = new DataCaptureView();
      view.connectToElement(document.getElementById("app"));
      view.showProgressBar();

      await configure({
        licenseKey: "-- ENTER LICENSE KEY HERE --",
        libraryLocation: "https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@7/sdc-lib/",
        moduleLoaders: [barcodeCaptureLoader()],
      });

      view.hideProgressBar();

      const camera = Camera.default;
      const context = await DataCaptureContext.create();
      await view.setContext(context);

      const cameraSettings = BarcodeCapture.recommendedCameraSettings;
      await camera.applySettings(cameraSettings);

      await context.setFrameSource(camera);
      await context.frameSource.switchToDesiredState(FrameSourceState.On);

      const settings = new BarcodeCaptureSettings();
      settings.enableSymbologies([Symbology.Code128, Symbology.QR]);
      const barcodeCapture = await BarcodeCapture.forContext(context, settings);

      barcodeCapture.addListener({
        didScan: async (mode, session) => {
          const barcode = session.newlyRecognizedBarcode;
          if (!barcode) return;
          const symbology = new SymbologyDescription(barcode.symbology);
          alert(`Scanned: ${barcode.data ?? ""}\n(${symbology.readableName})`);
        },
      });

      await barcodeCapture.setEnabled(true);
    </script>
  </head>
  <body><div id="app"></div></body>
</html>
```

---

## 3. Core Concepts

### 3.1 DataCaptureContext

The conductor for all capture activity. Modes attach to it; only one active mode at a time.

Recent additions (7.6.0):

- `DataCaptureContext.sharedInstance` — singleton accessor.
- `setMode(mode)` — designate the active mode (replaces deprecated `addMode`).
- `removeCurrentMode()` — clear active mode (replaces deprecated `removeAllModes`).
- `initialize(licenseKey, settings)` — reinitialize an existing context.
- `getOpenSourceSoftwareLicenseInfo()` — returns OSS license text.

### 3.2 DataCaptureView

Attaches camera + overlays into a DOM element:

```javascript
const view = await DataCaptureView.forContext(context);
view.connectToElement(document.querySelector("#root"));
```

Or create first and bind a context later:

```javascript
const view = new DataCaptureView();
view.connectToElement(htmlElement);
await view.setContext(context);
```

### 3.3 Camera & FrameSource

```javascript
import { Camera, FrameSourceState } from "@scandit/web-datacapture-core";

const camera = Camera.default;
await camera.applySettings(BarcodeCapture.recommendedCameraSettings);
await context.setFrameSource(camera);
await context.frameSource.switchToDesiredState(FrameSourceState.On);
```

States: `On`, `Off`, `Standby`. `Standby` pauses streaming without tearing down the camera.

> Deprecation notice (7.6.0): `Camera` and `CameraAccess` are slated to be replaced in 8.0.

### 3.4 Modes and listeners

Every mode supports `addListener(listener)`. Listener callbacks are invoked on background threads — perform DOM work on the main thread.

---

## 4. Single Scanning

Source: <https://docs.scandit.com/7.6.14/sdks/web/single-scanning/>

Two products for single-barcode workflows:

**[SparkScan](#8-sparkscan) (recommended)** — pre-built UI + workflow. Includes:

- Pre-constructed UI (trigger button, camera preview, controls)
- Full workflow: visual, audio, haptic feedback
- Hardware trigger support (volume / dedicated buttons)
- Aimer for precision in dense environments
- Pre-configured rejection + error feedback
- Single or continuous mode (selectable)
- Battery optimization via standby

**[Barcode Capture](#6-barcode-capture-low-level-api)** — low-level API, full control, you build the UI.

> Use SparkScan for production workflows unless you need bespoke UI.

---

## 5. Batch Scanning (MatrixScan family)

Source: <https://docs.scandit.com/7.6.14/sdks/web/batch-scanning/>

Multiple barcodes per frame, often with AR overlays.

**Low-level APIs:**

- **[MatrixScan Batch](#9-matrixscan-batch-barcodebatch)** (`BarcodeBatch`) — multi-barcode tracking without AR; lightest weight.
- **MatrixScan AR** — superset of Batch with AR overlays + custom workflows (not enumerated as a separate v7.6.14 web page — see release notes 7.1.0/7.3.0).

**Purpose-built workflows:**

- **[MatrixScan Count](#11-matrixscan-count)** — stocktake/cycle-count; persistent AR; handles duplicates.
- **[MatrixScan Find](#10-matrixscan-find-barcodefind)** — locate items matching a list; AR highlights.
- **[MatrixScan Pick](#12-matrixscan-pick)** — task picking; `toPick → Picked / Ignore` states.

**Feature comparison:**

| Capability | Find | Count | Pick | Batch | AR |
|---|---|---|---|---|---|
| AR overlays | Highlights | Persistent | Task picking | None | Configurable |
| Duplicate handling | No | Yes | No | Yes | Yes |
| Prebuilt workflow | Yes | Yes | Yes | No | No |
| Customization | Limited | Limited | Limited | Moderate | Full |
| Integration ease | High | High | High | Medium | Variable |

> **Symbology limits across MatrixScan**: DotCode, MaxiCode, and postal codes (KIX, RM4SCC) are not supported.

---

## 6. Barcode Capture (low-level API)

Source: <https://docs.scandit.com/7.6.14/sdks/web/barcode-capture/get-started/>

### 6.1 Setup

```javascript
import { configure, DataCaptureContext, Camera, FrameSourceState, DataCaptureView } from "@scandit/web-datacapture-core";
import {
  barcodeCaptureLoader, BarcodeCapture, BarcodeCaptureSettings,
  BarcodeCaptureOverlay, Symbology
} from "@scandit/web-datacapture-barcode";

await configure({
  licenseKey: "-- ENTER YOUR SCANDIT LICENSE KEY HERE --",
  libraryLocation: new URL("self-hosted-sdc-lib/", document.baseURI).toString(),
  moduleLoaders: [barcodeCaptureLoader()],
});

const context = await DataCaptureContext.create();

const settings = new BarcodeCaptureSettings();
settings.enableSymbologies([
  Symbology.Code128, Symbology.Code39, Symbology.QR,
  Symbology.EAN8, Symbology.UPCE, Symbology.EAN13UPCA,
]);

const barcodeCapture = await BarcodeCapture.forContext(context, settings);

barcodeCapture.addListener({
  didScan: (mode, session, frameData) => {
    const barcode = session.newlyRecognizedBarcode;
    // process barcode
  },
});

const cameraSettings = BarcodeCapture.recommendedCameraSettings;
const camera = Camera.default;
await camera.applySettings(cameraSettings);
await context.setFrameSource(camera);
await context.frameSource.switchToDesiredState(FrameSourceState.On);

const view = await DataCaptureView.forContext(context);
view.connectToElement(document.querySelector("#the-element-where-to-attach-the-view"));

const overlay = await BarcodeCaptureOverlay.withBarcodeCaptureForView(barcodeCapture, view);
```

### 6.2 Rejecting barcodes

Override the brush per scan to visually reject; disable scanning when satisfied:

```javascript
import { Brush } from "@scandit/web-datacapture-core";

const defaultBrush = overlay.getBrush();

barcodeCapture.addListener({
  didScan: async (mode, session, frameData) => {
    const barcode = session.newlyRecognizedBarcode;
    if (!barcode?.data?.startsWith("09")) {
      await overlay.setBrush(Brush.transparent);
      return;
    }
    await overlay.setBrush(defaultBrush);
    await barcodeCapture.setEnabled(false);
  },
});
```

### 6.3 Enable / disable

```javascript
await barcodeCapture.setEnabled(false);
```

> Disabling the mode does not stop the camera. Move the frame source to `FrameSourceState.Standby` or `Off` to actually stop streaming.

---

## 7. Symbologies

Source: <https://docs.scandit.com/7.6.14/sdks/web/barcode-capture/configure-barcode-symbologies/>

By default **no symbology is enabled**. Enable only those you need for best performance.

### 7.1 Enabling symbologies

```javascript
import { BarcodeCaptureSettings, Symbology } from "@scandit/web-datacapture-barcode";

const settings = new BarcodeCaptureSettings();
settings.enableSymbology(Symbology.Code128, true);
```

For other modes use the corresponding settings class: `SparkScanSettings`, `BarcodeBatchSettings`, `BarcodeFindSettings`, `BarcodePickSettings`.

### 7.2 Industry presets

Available for single-scan modes (not MatrixScan).

| Preset | Symbologies |
|---|---|
| TRANSPORT | Code128, QR, Code39, Data Matrix, EAN13_UPCA, ITF, Aztec, EAN8, PDF417, UPCE |
| LOGISTICS | Code128, QR, Code39, Data Matrix, EAN13_UPCA, ITF, Codabar, EAN8, PDF417, UPCE |
| RETAIL | EAN13_UPCA, Code128, QR, Code39, EAN8, Data Matrix, ITF, UPCE, GS1 Databar, GS1 Databar Expanded |
| HEALTHCARE | Code128, Data Matrix, QR, EAN13_UPCA, Code39, MicroPDF417, ITF, MSI Plessey, EAN8 |
| MANUFACTURING | Code128, Data Matrix, Code39, QR, EAN13_UPCA, ITF, PDF417, UPCE, EAN8 |

Presets can be combined with per-symbology enables/disables.

### 7.3 Active symbol counts

```javascript
const symbologySettings = settings.settingsForSymbology(Symbology.Code128);
symbologySettings.activeSymbolCounts = [6, 7, 8];
```

### 7.4 Color-inverted barcodes

```javascript
const symbologySettings = settings.settingsForSymbology(Symbology.Code128);
symbologySettings.isColorInvertedEnabled = true;
```

> Color-inverted QR/MicroQR are auto-detected since 7.1.0 — no setting required.

### 7.5 Checksum enforcement

```javascript
import { Checksum } from "@scandit/web-datacapture-barcode";

const symbologySettings = settings.settingsForSymbology(Symbology.Code39);
symbologySettings.checksums = [Checksum.Mod43];
```

> Your code data must include the correct checksum or the read is discarded.

### 7.6 Symbology extensions

```javascript
const symbologySettings = settings.settingsForSymbology(Symbology.Code39);
symbologySettings.setExtensionEnabled("full_ascii", true);
```

Example: `full_ascii` extends Code 39 to all 128 ASCII characters but is disabled by default because of false-read risk.

---

## 8. SparkScan

Sources: [intro](https://docs.scandit.com/7.6.14/sdks/web/sparkscan/intro/) · [get-started](https://docs.scandit.com/7.6.14/sdks/web/sparkscan/get-started/) · [advanced](https://docs.scandit.com/7.6.14/sdks/web/sparkscan/advanced/)

### 8.1 Overview & modes

Pre-built scanning UI overlaying your app. Aimed at scan-heavy workflows (retail inventory, logistics receiving).

**Scanning modes:**

- **Default** — close-range, fast-paced; small preview with zoom/aim assistance.
- **Target** — precision mode with aimer for dense barcode walls.

**Behaviors:**

- **Single Scan** — one barcode per trigger; lower battery, controlled scanning.
- **Continuous Scan** — hold to keep scanning; no per-scan interaction.

**Camera preview:**

- **Default** — preview hides when inactive.
- **Persistent** — stays visible (darkened) when inactive; better for selection among multiple codes.

**UI:** small camera preview + a large transparent draggable trigger button that collapses when idle.

### 8.2 Setup

```javascript
import { configure, DataCaptureContext } from "@scandit/web-datacapture-core";
import {
  barcodeCaptureLoader, SparkScanSettings, SparkScan,
  SparkScanView, SparkScanViewSettings, Symbology
} from "@scandit/web-datacapture-barcode";

await configure({
  libraryLocation: new URL("sdc-lib-self-hosted-path", document.baseURI).toString(),
  licenseKey: "-- ENTER YOUR SCANDIT LICENSE KEY HERE --",
  moduleLoaders: [barcodeCaptureLoader()],
});

const dataCaptureContext = await DataCaptureContext.create();

const sparkScanSettings = new SparkScanSettings();
sparkScanSettings.enableSymbologies([Symbology.EAN13UPCA]);

const sparkScan = SparkScan.forSettings(sparkScanSettings);

const sparkScanViewSettings = new SparkScanViewSettings();
const sparkScanView = SparkScanView.forElement(
  document.body, dataCaptureContext, sparkScan, sparkScanViewSettings
);
await sparkScanView.prepareScanning();

sparkScan.addListener({
  didScan: (mode, session, frameData) => {
    const barcode = session.newlyRecognizedBarcode;
    if (barcode != null) {
      // handle barcode
    }
  },
});
```

Lifecycle:

```javascript
function disconnectedCallback() { sparkScanView.stopScanning(); }

const handleAppStateChange = async (nextAppState) => {
  if (nextAppState.match(/inactive|background/)) {
    sparkScanView.stopScanning();
  }
};
```

### 8.3 Advanced (feedback delegate, custom trigger, toolbar)

**Custom error/success feedback** — `SparkScanFeedbackDelegate`:

```javascript
const sparkScanFeedbackDelegate = {
  getFeedbackForBarcode: (barcode) => {
    if (isValidBarcode(barcode)) {
      return new SparkScanBarcodeSuccessFeedback();
    }
    return new SparkScanBarcodeErrorFeedback(
      "This code should not have been scanned",
      60 * 1000,                              // resumeCapturingDelay (ms)
      Color.fromHex("#FF0000"),
      new Brush(Color.fromHex("#FF0000"), Color.fromHex("#FF0000"), 1),
    );
  },
};

sparkScanView.feedbackDelegate = sparkScanFeedbackDelegate;
```

- `resumeCapturingDelay > 10_000` ms generally requires user interaction to resume.
- `resumeCapturingDelay < 2_000` ms briefly pauses then resumes automatically.
- Set it to `0` to keep scanning immediately past a rejection.

**Custom trigger button** — hide the default and drive scanning yourself:

```javascript
sparkScanView.triggerButtonVisible = false;
// then on your own button:
sparkScanView.startScanning();
// to pause:
sparkScanView.pauseScanning();
```

**Settings toolbar** — Target Mode and Continuous Mode toggles become visible when the toolbar is enabled.

**Cross-mode buttons** (jump to Label Capture or BarcodeFind):

```javascript
sparkScanView.labelCaptureButtonVisible = true;
sparkScanView.barcodeFindButtonVisible  = true;

sparkScanView.setListener({
  // handle toolbar button taps and transition modes
});
```

**Other UI customizations:** item / button / toolbar colors, trigger icon, toast text, preview size, icon visibility, button behavior, ARIA labels (since 7.5.0).

---

## 9. MatrixScan Batch (BarcodeBatch)

Source: <https://docs.scandit.com/7.6.14/sdks/web/matrixscan/get-started/>

Multi-barcode tracking via `BarcodeBatch`.

> Requires **multithreading**. Enable cross-origin isolation:
>
> ```
> Cross-Origin-Embedder-Policy: require-corp
> Cross-Origin-Opener-Policy: same-origin
> Cross-Origin-Resource-Policy: cross-origin
> ```
>
> Check support with `BrowserHelper.checkMultithreadingSupport()`.

```javascript
const context = await SDCCore.DataCaptureContext.create();

const settings = new SDCBarcode.BarcodeBatchSettings();
settings.enableSymbologies([SDCBarcode.Symbology.QR]);

const barcodeBatch = await SDCBarcode.BarcodeBatch.forContext(context, settings);

const camera = SDCCore.Camera.default;
const cameraSettings = SDCBarcode.BarcodeBatch.recommendedCameraSettings;
await camera.applySettings(cameraSettings);
await context.setFrameSource(camera);

import { FrameSourceState } from "@scandit/web-datacapture-core";
await camera.switchToDesiredState(FrameSourceState.On);

const view = await SDCCore.DataCaptureView.forContext(context);
view.connectToElement(htmlElement);

const overlay = await SDCBarcode.BarcodeBatchBasicOverlay
  .withBarcodeBatchForView(barcodeBatch, view);

overlay.listener = {
  brushForTrackedBarcode: (overlay, trackedBarcode) => { /* return Brush */ },
  didTapTrackedBarcode: (overlay, trackedBarcode) => { /* handle tap */ },
};

import { Feedback } from "@scandit/web-datacapture-core";
const feedback = Feedback.defaultFeedback;
barcodeBatch.addListener({
  didUpdateSession: (mode, session) => {
    if (session.addedTrackedBarcodes.length > 0) feedback.emit();
  },
});

barcodeBatch.setEnabled(true);
```

To suspend scanning: `barcodeBatch.setEnabled(false)`. To stop the camera: `camera.switchToDesiredState(FrameSourceState.Standby)`.

> **Renamed in 7.0.0:** old `BarcodeTracking` → new `BarcodeBatch`.

---

## 10. MatrixScan Find (BarcodeFind)

Sources: [intro](https://docs.scandit.com/7.6.14/sdks/web/matrixscan-find/intro/) · [get-started](https://docs.scandit.com/7.6.14/sdks/web/matrixscan-find/get-started/) · [advanced](https://docs.scandit.com/7.6.14/sdks/web/matrixscan-find/advanced/)

### 10.1 Overview

Pre-built UI for locating items that match predefined criteria, using AR overlays. Two pieces:

- `BarcodeFind` — the capture mode.
- `BarcodeFindView` — pre-built UI.

UI components: **shutter button**, visual dots highlighting matches, and a search carousel with check marks.

### 10.2 Setup

```javascript
await configure({
  licenseKey: "-- ENTER YOUR SCANDIT LICENSE KEY HERE --",
  libraryLocation: new URL("library/engine/", document.baseURI).toString(),
  moduleLoaders: [barcodeCaptureLoader({ highEndBlurryRecognition: false })],
});

const context = await DataCaptureContext.create();
const dataCaptureView = new DataCaptureView();
dataCaptureView.connectToElement(document.getElementById("root"));
await dataCaptureView.setContext(context);

const settings = new BarcodeFindSettings();
settings.enableSymbologies([Symbology.EAN13UPCA]);
const barcodeFind = await BarcodeFind.forSettings(settings);

const items: BarcodeFindItem[] = [];
items.push(new BarcodeFindItem(
  new BarcodeFindItemSearchOptions("9783598215438"),
  new BarcodeFindItemContent("Mini Screwdriver Set", "(6-Piece)", null),
));
items.push(new BarcodeFindItem(
  new BarcodeFindItemSearchOptions("9783598215414"),
  null,
));

const viewSettings = new BarcodeFindViewSettings(
  Color.fromHex("#00FF00"),  // in-list color
  Color.fromHex("#FF0000"),  // not-in-list color
  true,                       // sound enabled
  true,                       // haptic enabled
);

const barcodeFindView = await BarcodeFindView.createWithSettings(
  dataCaptureView, context, barcodeFind, viewSettings,
);

await barcodeFind.setItemList(items);

barcodeFindView.setListener({
  didTapFinishButton: (foundItems) => { /* process */ },
});

barcodeFindView.startSearching();
```

### 10.3 Listener events

```javascript
barcodeFindMode.addListener({
  didStartSearch: () => { /* mode started */ },
  didPauseSearch: (foundItems) => { /* mode paused */ },
  didStopSearch:  (foundItems) => { /* finish tapped */ },
});
```

> Listener callbacks run on background threads.

### 10.4 UI customization

Show/hide the play-pause, finish, carousel, hints, progress bar (hidden by default):

```javascript
barcodeFindView.setShouldShowCarousel(false);
barcodeFindView.setShouldShowProgressBar(true);
```

---

## 11. MatrixScan Count

Source: <https://docs.scandit.com/7.6.14/sdks/web/matrixscan-count/intro/> (limited content for web 7.6.14)

Persistent-AR multi-barcode counting; handles duplicates; suited to stocktake / cycle counting / receiving. Includes barcode clustering and tote mapping. The `get-started` and `advanced` pages weren't available for web 7.6.14 at compile time — see [Pages unavailable](#16-pages-unavailable-in-7614-web).

---

## 12. MatrixScan Pick

Sources: [intro](https://docs.scandit.com/7.6.14/sdks/web/matrixscan-pick/intro/) (limited content for web 7.6.14)

AR-based picking workflow with predefined item states (`toPick → Picked / Ignore`) and a freeze mode for selection. The full setup / advanced pages weren't available for web 7.6.14 at compile time.

---

## 13. ID Capture & Validation

Sources: [intro](https://docs.scandit.com/7.6.14/sdks/web/id-capture/intro/) · [get-started](https://docs.scandit.com/7.6.14/sdks/web/id-capture/get-started/) · [advanced](https://docs.scandit.com/7.6.14/sdks/web/id-capture/advanced/)

### 13.1 Overview

Scans personal ID documents (driver's licenses, passports, ID cards, visas) using OCR, barcode scanning, and image recognition. Runs on-device. Supports age verification, authenticity checks, real-time data extraction.

> Cloud-based alternative: **ID Bolt** for rapid web integration.
>
> **Constraint:** ID Capture cannot be active concurrently with other capture modes (e.g. Barcode Capture).

### 13.2 Required modules

| Module | Purpose |
|---|---|
| ScanditCaptureCore | Always required |
| ScanditIdCapture | Always required |
| ScanditIdCaptureBackend | Extract VIZ document data |
| ScanditIdAamvaBarcodeVerification | Verify US driver licenses |
| ScanditIdVoidedDetection | Reject voided IDs |

### 13.3 Setup walkthrough

**1. Configure:**

```javascript
import { configure } from "@scandit/web-datacapture-core";
import { idCaptureLoader } from "@scandit/web-datacapture-id";

await configure({
  licenseKey: "-- ENTER YOUR SCANDIT LICENSE KEY HERE --",
  libraryLocation: "/self-hosted-sdc-lib/",
  moduleLoaders: [idCaptureLoader({ enableVIZDocuments: true })],
});
```

> Skip `enableVIZDocuments` if you only need MRZ or barcodes — initialization is much faster.

**2. Create view:**

```javascript
import { DataCaptureView } from "@scandit/web-datacapture-core";

const view = new DataCaptureView();
view.connectToElement(htmlElement);
view.showProgressBar();
```

**3. Context:**

```javascript
import { DataCaptureContext } from "@scandit/web-datacapture-core";

const context = await DataCaptureContext.create();
view.setContext(context);
```

**4. Camera:**

```javascript
import { Camera } from "@scandit/web-datacapture-core";
import { IdCapture } from "@scandit/web-datacapture-id";

const camera = Camera.default;
await context.setFrameSource(camera);
const cameraSettings = IdCapture.recommendedCameraSettings;
await camera.applySettings(cameraSettings);
```

**5. Settings (`acceptedDocuments` / `rejectedDocuments`, scanner type):**

```javascript
import {
  IdCapture, IdCaptureSettings, IdCard, Region, RegionSpecific,
  Passport, SingleSideScanner, FullDocumentScanner,
} from "@scandit/web-datacapture-id";

const settings = new IdCaptureSettings();

settings.acceptedDocuments.push(new IdCard(Region.AnyRegion));
settings.acceptedDocuments.push(new IdCard(Region.Germany));
settings.acceptedDocuments.push(new RegionSpecific.ApecBusinessTravelCard());

settings.rejectedDocuments.push(new Passport(Region.Cuba));

// SingleSideScanner(barcode, mrz, viz)
settings.scannerType = new SingleSideScanner(true, false, false);
// or both sides:
settings.scannerType = new FullDocumentScanner();

const idCapture = await IdCapture.forContext(context, settings);
```

**6. Listener:**

```javascript
import { type CapturedId, RejectionReason } from "@scandit/web-datacapture-id";

idCapture.addListener({
  didCaptureId: async (capturedId: CapturedId) => {
    await idCapture.setEnabled(false);
    const { fullName, dateOfBirth, dateOfExpiry, documentNumber } = capturedId;
    processData(fullName, dateOfBirth, dateOfExpiry, documentNumber);
  },
  didRejectId: (capturedId: CapturedId, reason: RejectionReason) => {
    if (reason === RejectionReason.Timeout)               { /* prompt retry */ }
    else if (reason === RejectionReason.DocumentExpired)  { /* request alt   */ }
    else if (reason === RejectionReason.NotAcceptedDocumentType) { /* inform */ }
  },
});
```

> All `CapturedId` fields are optional — check before use. For two-sided `FullDocumentScanner`, `didCaptureId` only fires after both sides are captured.

**7. Overlay:**

```javascript
import { IdCaptureOverlay } from "@scandit/web-datacapture-id";

const overlay = await IdCaptureOverlay.withIdCaptureForView(idCapture, dataCaptureView);
```

The overlay auto-selects UI based on `IdCaptureSettings`; override with `IdCaptureOverlay.idLayout`.

**8. Start:**

```javascript
import { FrameSourceState } from "@scandit/web-datacapture-core";

await camera.switchToDesiredState(FrameSourceState.On);
// later:
await idCapture.setEnabled(false);
await idCapture.setEnabled(true);
```

### 13.4 Rejection reasons

- `Timeout`
- `DocumentExpired`
- `NotAcceptedDocumentType`
- `InvalidFormat`
- `DocumentVoided`

Partial data may be present on the `capturedId` parameter even on rejection — inspect before discarding.

### 13.5 Anonymization

```javascript
settings.anonymizationMode = IdAnonymizationMode.FieldsOnly;       // default
settings.anonymizationMode = IdAnonymizationMode.FieldsAndImages;
settings.anonymizationMode = IdAnonymizationMode.ImagesOnly;
settings.anonymizationMode = IdAnonymizationMode.None;
```

### 13.6 ID images

```javascript
import { IdImageType } from "@scandit/web-datacapture-id";

settings.setShouldPassImageTypeToResult(IdImageType.Face, true);
settings.setShouldPassImageTypeToResult(IdImageType.CroppedDocument, true);
settings.setShouldPassImageTypeToResult(IdImageType.FullFrame, true);
```

> Face and Cropped Document require either `SingleSideScanner` with VIZ enabled, or `FullDocumentScanner`.

### 13.7 Fake-ID detection (ID Validate)

Two verifiers for AAMVA documents:

- `AAMVABarcodeVerifier` — authenticity via back-side barcode.
- `DataConsistencyVerifier` — VIZ vs MRZ vs barcode consistency.

Auto-reject during capture:

```javascript
IdCaptureSettings.rejectInconsistentData
IdCaptureSettings.rejectForgedAamvaBarcodes
```

> Contact Scandit Support to enable ID validation on your subscription.

> The standalone `id-validate/intro/` and `id-validate/get-started/` pages return **404** for web 7.6.14 — validation functionality is exposed through ID Capture's settings/verifiers (see release notes 7.1.0 and 7.6.0).

---

## 14. Parser

Source: <https://docs.scandit.com/7.6.14/sdks/web/parser/get-started/>

The Parser converts barcode-encoded payloads into structured key-value JSON.

**Supported formats:**

- HIBC (Health Industry Bar Code)
- GS1 Application Identifier system (since 7.6.0, dates may be `YYYYMM`)
- Swiss QR codes
- VIN (Vehicle Identification Number)
- IATA BCBP (Bar Coded Boarding Pass)

Modules:

| Module | Required deps |
|---|---|
| ScanditParser | None |
| ScanditCaptureCore | None |
| ScanditBarcodeCapture | ScanditCaptureCore |

**Install:**

```bash
npm install --save @scandit/web-datacapture-core @scandit/web-datacapture-barcode @scandit/web-datacapture-parser
```

**Configure + create parser:**

```javascript
import { configure, DataCaptureContext } from "@scandit/web-datacapture-core";
import { barcodeCaptureLoader } from "@scandit/web-datacapture-barcode";
import { parserLoader, Parser, ParserDataFormat } from "@scandit/web-datacapture-parser";

await configure({
  licenseKey: "-- YOUR LICENSE KEY --",
  libraryLocation: new URL("library/engine/", document.baseURI).toString(),
  moduleLoaders: [barcodeCaptureLoader(), parserLoader()],
});

const context = await DataCaptureContext.create();

const parserIata = await Parser.forFormat(context, ParserDataFormat.IATA_BCBP);

const encodedData = "M1BLEAH/ZZZZZZ        EU3TAVO LCAZRHCY 0350 259Y009A0131...";
const parsed = await parserIata.parseStringToJson(encodedData);
```

Key methods:

- `Parser.forFormat(context, format)` — create a parser for a specific format.
- `parseStringToJson(dataString)` — parse a string into JSON.

> The Parser is a standalone npm package (split off in 7.0.0).

---

## 15. Release Notes (7.0 → 7.6.14)

Source: <https://docs.scandit.com/7.6.14/sdks/web/release-notes/>

Trimmed for readability; full text per release at the source URL.

### 7.6.x

- **7.6.14** (May 8, 2026) — no framework-specific updates.
- **7.6.13** (Apr 27, 2026) — Smart Label Capture: memory leak in `LabelCapture` fixed.
- **7.6.12** (Apr 21, 2026) — Core: fixed crash when `DataCaptureContext` singleton was initialized more than once.
- **7.6.11** (Apr 16, 2026) — Barcode: crash fix for k-out-of-n filter with some unfiltered detections.
- **7.6.10** (Apr 2, 2026) — Core: JS in `sdc-lib` correctly downleveled for min browser version.
- **7.6.9** (Mar 17, 2026) — Core: app-hang fix on background transition for licenses without analytics.
- **7.6.8** (Mar 6, 2026) — no framework-specific updates.
- **7.6.7** (Feb 2, 2026) — Core: reduced memory spikes during scanner configuration.
- **7.6.6** (Jan 23, 2026) — Barcode: rare OOB crash for blurry EAN13/UPCA; Core: Angular 15 production-build treeshake bug fixed.
- **7.6.5** (Nov 12, 2025) — Core: memory leak and unnecessary retention in some MatrixScan modes fixed.
- **7.6.4** (Nov 5, 2025) — Core: camera-not-visible bug fixed.
- **7.6.3** (Oct 29, 2025) — no framework-specific updates.
- **7.6.2** (Oct 20, 2025) — Core: Firefox-for-Android scanner fix; Barcode: `BarcodeFind` cards now render default icon; Smart Label Capture: new `ReceiptScanningListener` connection-error callback.
- **7.6.1** (Sep 18, 2025) — Core: DataMatrix `254`-codeword fix, Aztec timing-pattern improvements; Barcode: `BarcodeFindItemContent` rendering + non-UTF-8 data crash fixes.
- **7.6.0** (Sep 15, 2025) — see below.

### 7.6.0 highlights

- Set `Camera` into context **before** `configure()`.
- New `DataCaptureContext` API: `setMode`, `removeCurrentMode`, `static sharedInstance`, `initialize()`.
- `BarcodeScan` added to `BarcodeArAnnotationTrigger` for persistent AR annotations.
- Smart Label Capture: automatic on-scan feedback.
- ID: proprietary Transaction ID per scan; improved mDL UX; more Canadian/UK Mil/US DL/Georgia MMJ support.
- Parser: GS1 now allows `YYYYMM` dates.
- Behavior: min Chrome version is now 64+; MRZ fields renamed `optional` → `optionalDataInLine1`, `optional1` → `optionalDataInLine2`.
- Deprecations: `addMode`, `removeAllModes`, `Camera`, `CameraAccess`, `BarcodeCaptureOverlayStyle`, `resultShouldContainImage`, `AamvaBarcodeVerification`, `decodeIsoMobileDriverLicenses`, `decodeMobileDriverLicenseViz`.

### 7.5.x

- **7.5.2** (Dec 4, 2025) — Barcode: EAN13/UPCA OOB crash + non-UTF-8 data crash + MatrixScan memory leak fixes.
- **7.5.1** (Sep 4, 2025) — Core: min Chrome 64+; warning suggests `web-animation-js` polyfill.
- **7.5.0** (Aug 12, 2025) — Barcode: SparkScan **Smart Scan Selection**; Barcode AR customizable notifications; 48 px min tappable area for `BarcodeArStatusIconAnnotation`; ARIA labels on `DataCaptureView`; non-standard GS1 AI support; `Barcode.moduleCount` exposed. ID: ISO-18013 mDL scanning; new `didLocalizeId` listener; partial result after front-side via `notifyOnPartialCapture`.

### 7.4.x

- **7.4.5** (Feb 6, 2026) — non-UTF-8 data crash fix.
- **7.4.4** (Nov 22, 2025) — rare EAN/UPC reader crash + MatrixScan memory leak.
- **7.4.3** (Aug 29, 2025) — no framework-specific updates.
- **7.4.2** (Aug 15, 2025) — non-standard GS1 AI support; SparkScan orientation fix; `BarcodeArStatusIconAnnotation.backgroundColor` getter/setter fix.
- **7.4.1** (Jul 14, 2025) — ID: German passport `BirthName` now in `additionalNameInformation`.
- **7.4.0** (Jun 19, 2025) — `LaserViewfinder` available; Spanish "Green NIE" and US medical-marijuana ID support; Smart Label Capture **Validation Flow**; `setDataPatterns`/`resetDataPatterns`; MbedTLS 3.6.2→3.6.3; `triggerButtonCollapseTimeout` fix; safe `localStorage`/`sessionStorage` access.

### 7.3.x

- **7.3.4** (Feb 24, 2026) — no framework-specific updates.
- **7.3.3** (Jul 25, 2025) — ID: OTA model loading order fix.
- **7.3.2** (Jun 25, 2025) — no framework-specific updates.
- **7.3.1** (Jun 13, 2025) — `triggerButtonCollapseTimeout` scenario fix.
- **7.3.0** (May 16, 2025) — MatrixScan AR elements may extend outside the viewport; **ArUco symbology** supported on Web; structured-append QR; ID: unified sex field parsing; mDL scanning; SparkScan mini-preview/`configure()` error/parent-dimension fixes. **MatrixScan Check → MatrixScan AR rename.**

### 7.2.x

- **7.2.6** (Nov 10, 2025) — Core: removed unnecessary MatrixScan data retention.
- **7.2.5** (Nov 5, 2025) — MatrixScan memory leak fix.
- **7.2.4** (Aug 8, 2025) — no framework-specific updates.
- **7.2.3** (Jun 24, 2025) — no framework-specific updates.
- **7.2.2** (May 9, 2025) — MatrixScan Batch / ArUco pair fix.
- **7.2.1** (Apr 24, 2025) — Safari API access fix; SparkScanView parent-dim fix; mini-preview-closed-after-scan fix.
- **7.2.0** (Mar 31, 2025) — **Smart Label Capture released**; `DataCaptureContext` shared instance; `isPulsing` on MatrixScan AR circle highlights; ID: mDL scanning (Australia first); default `BarcodeBatchBasicOverlayStyle.FRAME` brush changed white → Scandit blue; SparkScan duplicate-trigger-button fix.

### 7.1.x

- **7.1.3** (Mar 26, 2025) — no framework-specific updates.
- **7.1.2** (Mar 13, 2025) — SparkScan barcode-location rendering fix; "error 28" filename fix.
- **7.1.1** (Mar 7, 2025) — `sc_recognition_context_release` background-setup abort fix.
- **7.1.0** (Feb 21, 2025) — **MatrixScan AR** released; **Smart Duplicate Filter**; user-facing camera in SparkScan; ID: **DataConsistency Verification** + **Rejection API**; seamless `FullDocument` scanning; Indian passport / China Mainland Travel Permit MRZ; unified sex field; `UsRealIdStatus`. Performance: +10 % QR scan rate at high perspective distortion; forged-barcode model improvement. Behavior: color-inverted QR/MicroQR autodetected. Deprecations: `addMode`, `removeAllModes` removed.

### 7.0.x

- **7.0.2** (Jan 20, 2025) — SparkScanView rendering order; passport VIZ scan fix; Romanian back-side fix; passport PIN anonymization fix; Spanish NIE residence-permit instantiation fix.
- **7.0.1** (Dec 19, 2024) — ID: post frame-source-change frame-processing fix.
- **7.0.0** (Nov 29, 2024) — major release:
  - **SparkScan redesigned** UI + simplified API.
  - `CODABAR` `remove_delimiter_data` extension.
  - `DataCaptureContext.openSourceSoftwareLicenseInfo()` for OSS attributions.
  - **ID Capture fully redesigned**: `acceptedDocuments`/`rejectedDocuments`, `scannerType`, `onIdCaptured`/`onIdRejected`.
  - **`BarcodeTracking` renamed → `BarcodeBatch`** (breaking).
  - NPM scope `scandit-web-datacapture-*` → `@scandit/web-datacapture-*`.
  - Parser split into standalone npm package.
  - Model files extension → `.model`.
  - Engine library path moved `build/engine` → `sdc-lib`.
  - Feedback resources lazy-loaded.
  - CSS templates minified.

---

## 16. Pages unavailable in 7.6.14 Web

These canonical pages exist in the sitemap but return "This functionality is not currently supported in the selected framework." for `framework=web` at v7.6.14:

- `/7.6.14/sdks/web/barcode-selection/intro/` and `/get-started/` — Barcode Selection (tap-to-select / aim-to-select) is not exposed on Web 7.6.14.
- `/7.6.14/sdks/web/barcode-generator/` — Barcode Generator not exposed on Web 7.6.14.
- `/7.6.14/sdks/web/matrixscan/intro/` — MatrixScan family intro page (Web instead lands directly on the per-product pages and the `get-started/` for `BarcodeBatch`).
- `/7.6.14/sdks/web/matrixscan-count/intro/`, `/get-started/`, `/advanced/` — MatrixScan Count detail pages.
- `/7.6.14/sdks/web/matrixscan-pick/intro/`, `/get-started/`, `/advanced/` — MatrixScan Pick detail pages.
- `/7.6.14/sdks/web/matrixscan-count/advanced/` and `/matrixscan-pick/advanced/` — also unavailable.

These pages return **404** for Web 7.6.14:

- `/7.6.14/sdks/web/id-validate/intro/`
- `/7.6.14/sdks/web/id-validate/get-started/`

For these features, see the [stable v8.4.0 docs](https://docs.scandit.com/8.4.0/sdks/web/) or use ID Capture's verifier API (covered in §13.7) for ID validation in 7.6.14.

---

## 17. Open-Source Apps, Samples & Tooling (GitHub)

Scandit publishes a sample app repository per platform plus a handful of supporting tools. Everything below is **Apache-2.0** licensed where a license file exists.

Org root: <https://github.com/Scandit>

### 17.1 Web sample apps

Repo: **[`Scandit/datacapture-web-samples`](https://github.com/Scandit/datacapture-web-samples)** — primary languages TypeScript (61 %), Svelte (16 %), JavaScript (12 %). Every sample ships a **StackBlitz** link so you can run it in the browser without cloning.

Five categories, organized by folder prefix:

#### `01_Single_Scanning_Samples`

| Sample | What it shows |
|---|---|
| **ListBuildingSample** | SparkScan-style pre-built UI for building a scanned-item list. Recommended starting point. |
| **BarcodeCaptureSimpleSample** | Minimal `BarcodeCapture` integration via the low-level API. |
| **BarcodeCaptureSimplePwaSample** | Same as above wrapped as a Progressive Web App (service worker + WASM caching). |

#### `02_ID_Scanning_Samples`

| Sample | What it shows |
|---|---|
| **IdCaptureSimpleSample** | Bare-minimum `IdCapture` setup. |
| **IdCaptureSettingsSample** | Exercising every `IdCaptureSettings` knob (scanner type, accepted/rejected documents, anonymization). |
| **IdCaptureExtendedSample** | Full result inspection across VIZ, MRZ, and barcode. |
| **IdCaptureUSDLVerificationSample** | AAMVA back-side verification for US driver licenses. |
| **IdCaptureDriverOnboardingSample** | End-to-end onboarding workflow (front + back + data capture + review). |
| **IdCaptureShutterModeSample** | Manual "shutter button" capture instead of auto-trigger. |

#### `03_Advanced_Batch_Scanning_Samples`

| Sample | What it shows |
|---|---|
| **MatrixScanSimpleSample** | `BarcodeBatch` multi-barcode tracking without AR. |
| **MatrixScanBubblesSample** | Per-barcode bubble overlays with content and tap interactions. |
| **MatrixScanARSimpleSample** | MatrixScan AR with custom annotations / popovers. |
| **SearchAndFindSample** | `BarcodeFind` pre-built UI for locating items in a target list. |
| **LabelCaptureSimpleSample** | Smart Label Capture — multi-modal barcode + OCR extraction from a single frame. |

#### `05_Framework_Integration_Samples`

| Sample | What it shows |
|---|---|
| **BarcodeCaptureReactSample** | React + TypeScript wrapper around `BarcodeCapture` (hooks, refs, view mounting). |
| **SparkScanReactSample** | React integration of SparkScan with its full pre-built UI. |

> Section `04_*` is reserved for parser samples in other platforms but is not currently populated for Web. Use the Parser get-started snippet in §14 instead.

### 17.2 Scandit Skills (AI coding-agent integration)

Repo: **[`Scandit/skills`](https://github.com/scandit/skills)** (Apache-2.0). Pre-packaged skill bundles that teach AI coding agents how to integrate the Scandit SDK correctly.

**Supported agents:** Claude Code, Cursor, Codex, GitHub Copilot, Cline, Continue, Windsurf, and 35+ others via the Skills CLI.

**Skills available** (`{framework}` = ios, android, web, cordova, capacitor, flutter, react-native):

- `data-capture-sdk` — product-selection advisor. Asks about your use case and points you at the right concrete skill.
- `sparkscan-{framework}` — SparkScan integration.
- `barcode-capture-{framework}` — single-barcode scanning with `BarcodeCaptureSettings` + `DataCaptureView`.
- `matrixscan-ar-{framework}` — Barcode AR.
- `matrixscan-count-{framework}` — bulk counting with AR UI.
- `matrixscan-batch-{framework}` — `BarcodeBatch` tracking + per-barcode annotations.
- `matrixscan-pick-ios` — guided picking against product lists (iOS only at compile time).
- `label-capture-{framework}` — Smart Label Capture incl. migration support.
- `id-capture-{framework}` — ID document scanning.

**Install paths:**

```bash
# Skills CLI (works in 45+ agents)
npx skills add scandit/skills
# or just the SDK advisor:
npx skills add https://github.com/scandit/skills --skill data-capture-sdk

# Claude Code plugin marketplace
/plugin marketplace add scandit/skills

# Cursor
# one-click via the Cursor marketplace, auto-updates

# GitHub Copilot CLI
copilot plugin marketplace add scandit/skills

# Codex
codex plugin marketplace add scandit/skills
```

**Usage:** skills auto-load on matching prompts (e.g. "which Scandit SDK should I use"), or invoke explicitly: `/sparkscan-web use the skill to help me integrate the barcode scanner`.

### 17.3 Cross-platform sample repos

Useful when you have a hybrid stack or want to compare API shape across platforms.

| Repo | Stack | Stars |
|---|---|---|
| [`datacapture-android-samples`](https://github.com/Scandit/datacapture-android-samples) | Java/Kotlin | 30 |
| [`datacapture-ios-samples`](https://github.com/Scandit/datacapture-ios-samples) | Swift | 17 |
| [`datacapture-react-native-samples`](https://github.com/Scandit/datacapture-react-native-samples) | TypeScript | 18 |
| [`datacapture-flutter-samples`](https://github.com/Scandit/datacapture-flutter-samples) | Dart | 11 |
| [`datacapture-cordova-samples`](https://github.com/Scandit/datacapture-cordova-samples) | TypeScript | 2 |
| [`datacapture-capacitor-samples`](https://github.com/Scandit/datacapture-capacitor-samples) | TypeScript | — |
| [`datacapture-xamarin-forms-samples`](https://github.com/Scandit/datacapture-xamarin-forms-samples) | C# | 3 |

### 17.4 Frameworks & infrastructure repos

Source of the underlying native frameworks (mostly relevant if you're contributing or debugging native crashes):

| Repo | Purpose |
|---|---|
| [`scandit-datacapture-frameworks-core`](https://github.com/Scandit/scandit-datacapture-frameworks-core) | Core Swift framework used by iOS bindings. |
| [`scandit-datacapture-frameworks-barcode`](https://github.com/Scandit/scandit-datacapture-frameworks-barcode) | Barcode capability layer. |
| [`scandit-datacapture-frameworks-id`](https://github.com/Scandit/scandit-datacapture-frameworks-id) | ID Capture layer. |
| [`scandit-datacapture-frameworks-label`](https://github.com/Scandit/scandit-datacapture-frameworks-label) | Smart Label Capture layer. |
| [`scandit-datacapture-frameworks-parser`](https://github.com/Scandit/scandit-datacapture-frameworks-parser) | Parser utilities. |
| [`datacapture-spm`](https://github.com/Scandit/datacapture-spm) | Swift Package Manager distribution. |
| [`scandit-cocoapods-specs`](https://github.com/Scandit/scandit-cocoapods-specs) | CocoaPods spec repository. |
| [`scandit-capacitor-datacapture-price-label`](https://github.com/Scandit/scandit-capacitor-datacapture-price-label) | Capacitor integration for the price-label use case. |
| [`data-capture-documentation`](https://github.com/Scandit/data-capture-documentation) | MDX source of `docs.scandit.com` (Apache-2.0, accepts PRs). |

### 17.5 How to run a Web sample locally

The web samples assume Node 18+ and use npm workspaces / individual `package.json` per sample.

```bash
# 1. Clone
git clone https://github.com/Scandit/datacapture-web-samples.git
cd datacapture-web-samples

# 2. Pick a sample
cd 01_Single_Scanning_Samples/BarcodeCaptureSimpleSample

# 3. Install + run
npm install
npm run start
```

Most samples expect a **license key** in a `.env` file or hard-coded constant — see each sample's `README.md` for the exact variable name (often `SCANDIT_LICENSE_KEY` or `VITE_SCANDIT_LICENSE_KEY` depending on the bundler). Get a free trial key from the [Scandit dashboard](https://ssl.scandit.com/dashboard/sign-up?p=test).

For **instant in-browser preview**, click the StackBlitz badge in each sample's README — no clone, no install. Note that StackBlitz still needs you to paste a license key into the running app.

---

## 18. Useful Links

- **Web SDK docs root:** <https://docs.scandit.com/?framework=web>
- **Install / Add SDK:** <https://docs.scandit.com/7.6.14/sdks/web/add-sdk/>
- **API reference (current beta):**
  - Core: <https://docs.scandit.com/data-capture-sdk/web/core/api.html>
  - Barcode: <https://docs.scandit.com/data-capture-sdk/web/barcode-capture/api.html>
  - ID Capture: <https://docs.scandit.com/data-capture-sdk/web/id-capture/api.html>
  - Label Capture: <https://docs.scandit.com/data-capture-sdk/web/label-capture/api.html>
  - Parser: <https://docs.scandit.com/data-capture-sdk/web/parser/api.html>
- **Web samples (GitHub):** <https://github.com/Scandit/datacapture-web-samples>
- **Scandit org on GitHub:** <https://github.com/Scandit>
- **Agent skills repo:** <https://github.com/scandit/skills>
- **Docs source (MDX):** <https://github.com/Scandit/data-capture-documentation>
- **Test barcodes (PDF):** <https://github.com/Scandit/.github/blob/main/images/PrintTheseBarcodes.pdf>
- **Dashboard / license:** <https://ssl.scandit.com/dashboard/sign-in?p=test>
- **Migration 7 → 8:** <https://docs.scandit.com/migrate-7-to-8>
- **Patents:** <https://www.scandit.com/patents/>
- **Coding-assistant skill:** `npx skills add https://github.com/scandit/skills --skill data-capture-sdk`
