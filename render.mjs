import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const FPS = 30;
const DURATION = 35.55;
const TOTAL_FRAMES = Math.ceil(DURATION * FPS);
const FRAMES_DIR = path.resolve('./frames');

if (!fs.existsSync(FRAMES_DIR)) fs.mkdirSync(FRAMES_DIR, { recursive: true });

console.log(`Rendering ${TOTAL_FRAMES} frames at 1080x1920 (${FPS}fps)...`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1.5
});

await page.goto(`file://${path.resolve('./index.html')}`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const bar = document.getElementById('preview-bar');
  if (bar) bar.style.display = 'none';
});
await page.waitForTimeout(800);

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  const t = frame / FPS;
  await page.evaluate((sec) => window.seekTo(sec), t);
  const framePath = path.join(FRAMES_DIR, `frame_${String(frame).padStart(5, '0')}.png`);
  await page.screenshot({ path: framePath, type: 'png' });
  if (frame % 90 === 0) {
    console.log(`Rendered ${frame}/${TOTAL_FRAMES} frames (${((frame / TOTAL_FRAMES) * 100).toFixed(1)}%)`);
  }
}

await browser.close();
console.log('Stitching frames + normalizing voiceover (-16 LUFS) with FFmpeg...');

const audioCandidates = [
  'voiceover.wav',
  'Generated Audio November 25, 2026 - 1_12PM.wav'
];
const foundAudio = audioCandidates.find(f => fs.existsSync(f));

const ffmpegCmd = foundAudio
  ? `ffmpeg -y -framerate ${FPS} -i "${FRAMES_DIR}/frame_%05d.png" -i "${foundAudio}" -vf "scale=1080:1920" -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:v libx264 -pix_fmt yuv420p -r ${FPS} -c:a aac -b:a 192k -shortest prashanti_reels.mp4`
  : `ffmpeg -y -framerate ${FPS} -i "${FRAMES_DIR}/frame_%05d.png" -vf "scale=1080:1920" -c:v libx264 -pix_fmt yuv420p -r ${FPS} prashanti_reels.mp4`;

execSync(ffmpegCmd, { stdio: 'inherit' });
console.log('Done! Saved as prashanti_reels.mp4');