// 將 public/app-icon.svg 轉成多個尺寸的 PNG，給 iOS Safari 加入主畫面使用
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '..', 'public', 'app-icon.svg');
const PUBLIC = resolve(__dirname, '..', 'public');

const svg = readFileSync(SRC);

// iOS 各尺寸 + PWA 標準尺寸
const sizes = [180, 192, 512];

for (const size of sizes) {
  const out = resolve(PUBLIC, `app-icon-${size}.png`);
  await sharp(svg).resize(size, size).png().toBuffer().then(buf => writeFileSync(out, buf));
  console.log(`Generated ${out}`);
}
