// Toto, the mascot. Walk-in plate is on the greeting parchment.

const ASSET = {
  sit: "/toto/sit.png?v=5",
  wink: "/toto/wink.png?v=5",
  face: "/toto/face.png?v=5",
  plate: "/toto/sit-plate.png?v=5",
  enterWebm: "/toto/enter.webm?v=5",
  enterMp4: "/toto/enter.mp4?v=5",
} as const;

export type TotoPose = "sit" | "wink";

export function totoMascot(size = 220, pose: TotoPose = "sit"): string {
  const src = pose === "wink" ? ASSET.wink : ASSET.sit;
  return `
    <span class="toto-figure" style="width:${size}px">
      <img class="toto-figure__img" src="${src}" alt="" width="${size}" />
    </span>
  `;
}

export function totoHeroWalk(): string {
  return `
    <span class="toto-figure toto-figure--wide">
      <video class="toto-figure__vid" autoplay muted playsinline preload="auto"
             poster="${ASSET.plate}">
        <source src="${ASSET.enterWebm}" type="video/webm" />
        <source src="${ASSET.enterMp4}" type="video/mp4" />
      </video>
    </span>
  `;
}

export function totoAvatar(size = 40): string {
  return `
    <span class="toto-av" style="width:${size}px;height:${size}px">
      <img src="${ASSET.face}" alt="" width="${size}" height="${size}" />
    </span>
  `;
}

export { ASSET as TOTO_ASSETS };
