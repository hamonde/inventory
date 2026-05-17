// 從 public/app-icon-source.png 自動裁掉白邊後產生多個尺寸 PNG
// 給 iOS Safari 加入主畫面、Android PWA、瀏覽器分頁 favicon 使用
import sharp from 'sharp';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, '..', 'public');
const SOURCE_PNG = resolve(PUBLIC, 'app-icon-source.png');
const SOURCE_SVG = resolve(PUBLIC, 'app-icon.svg');

/**
 * trim() 會去掉四周相同色（包含白色）的邊；threshold 越大越寬鬆。
 * 我們先 trim 再 extend 一點點四邊內距，避免圖太貼邊。
 */
async function buildIcon(size, outPath) {
  // 若使用者有放 PNG 原圖就以它為主，沒有則用 SVG
  const src = existsSync(SOURCE_PNG) ? SOURCE_PNG : SOURCE_SVG;

  // 不做 trim、不加內距，直接縮放到目標尺寸
  const buf = await sharp(src)
    .resize(size, size, { fit: 'contain', background: { r: 251, g: 248, b: 242, alpha: 1 } })
    .png()
    .toBuffer();

  writeFileSync(outPath, buf);
  console.log(`Generated ${outPath}`);
}

const sizes = [32, 180, 192, 512];

for (const size of sizes) {
  const filename = size === 32 ? 'favicon-32.png' : `app-icon-${size}.png`;
  await buildIcon(size, resolve(PUBLIC, filename));
}
