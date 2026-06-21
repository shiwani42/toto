// Camera failure diagnostics. Maps the most common boot failures from
// getUserMedia + the WASM scanner to friendly messages.

export function cameraErrorMessage(err: unknown): string {
  const msg = (err as Error)?.message ?? String(err);
  const name = (err as Error)?.name ?? "";

  if (/notallowed|permission|denied/i.test(msg + name)) {
    return "Camera permission was denied. Allow camera access in your browser and reload.";
  }
  if (/notfound|no\s*camera|nomedia/i.test(msg + name)) {
    return "No camera available on this device.";
  }
  if (/notreadable|inuse|track|hardware/i.test(msg + name)) {
    return "The camera is busy with another app. Close it and try again.";
  }
  if (/wasm|module|fetch|network/i.test(msg)) {
    return "Couldn't load the scanner over the network. Check the connection and reload.";
  }
  return `Camera failed to start: ${msg.slice(0, 160)}`;
}
