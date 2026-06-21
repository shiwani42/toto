// Camera failure diagnostics. Most camera-boot failures fall into a few
// recognizable buckets. This helper returns an actionable message so the
// developer can see WHY the camera isn't opening on a given deploy.

export function cameraErrorMessage(err: unknown): string {
  const msg = (err as Error)?.message ?? String(err);
  const host = typeof location !== "undefined" ? location.hostname : "this host";

  if (/license|bundle|domain|origin|forbidden|403/i.test(msg)) {
    return `The Scandit license doesn't cover ${host}. Add this hostname to the license bundle (and to localhost.localdomain for local dev), then reload.`;
  }
  if (/notallowed|permission|denied/i.test(msg)) {
    return "Camera permission was denied. Allow camera access in your browser and reload.";
  }
  if (/notfound|no\s*camera|nomedia/i.test(msg)) {
    return "No camera available on this device.";
  }
  if (/wasm|module|fetch|network/i.test(msg)) {
    return "Couldn't load the scanner module over the network. Check the connection and reload.";
  }
  // Fallback: include a short slice of the raw message so the developer
  // can see what's actually wrong, without dumping a stack trace.
  return `Camera failed to start: ${msg.slice(0, 160)}`;
}
