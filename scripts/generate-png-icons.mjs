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
  let pipeline = sharp(src).trim({ threshold: 18 });

  // 內距：總尺寸的 4% 留白，外觀更穩定（避免 trim 後角色貼到邊框）
  const padPct = 0.04;
  const inner = Math.round(size * (1 - padPct * 2));

  pipeline = pipeline
    .resize(inner, inner, { fit: 'contain', background: { r: 251, g: 248, b: 242, alpha: 1 } })
    .extend({
      top: size - inner === 0 ? 0 : Math.round((size - inner) / 2),
      bottom: size - inner === 0 ? 0 : Math.round((size - inner) / 2),
      left: size - inner === 0 ? 0 : Math.round((size - inner) / 2),
      right: size - inner === 0 ? 0 : Math.round((size - inner) / 2),
      background: { r: 251, g: 248, b: 242, alpha: 1 },
    })
    .resize(size, size, { fit: 'cover' })
    .png();

  const buf = await pipeline.toBuffer();
  writeFileSync(outPath, buf);
  console.log(`Generated ${outPath}`);
}

const sizes = [32, 180, 192, 512];

for (const size of sizes) {
  const filename = size === 32 ? 'favicon-32.png' : `app-icon-${size}.png`;
  await buildIcon(size, resolve(PUBLIC, filename));
}
