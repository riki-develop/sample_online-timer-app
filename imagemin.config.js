import sharp from 'sharp';
import { optimize } from 'svgo';
import { globSync } from 'glob';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function compressImages() {
  const srcDir = path.resolve(__dirname, 'public/assets/images');
  const distDir = path.resolve(__dirname, 'public/assets/images_compressed');

  const files = globSync(`${srcDir}/**/*.{jpg,jpeg,png,webp,svg,gif}`);

  let count = 0;
  let totalOriginal = 0;
  let totalCompressed = 0;

  for (const file of files) {
    const relPath = path.relative(srcDir, file);
    const outPath = path.join(distDir, relPath);
    const outDir = path.dirname(outPath);

    fs.mkdirSync(outDir, { recursive: true });

    const ext = path.extname(file).toLowerCase();
    const originalSize = fs.statSync(file).size;

    try {
      if (ext === '.jpg' || ext === '.jpeg') {
        await sharp(file)
          .jpeg({ quality: 80, progressive: true, mozjpeg: true })
          .toFile(outPath);
      } else if (ext === '.png') {
        await sharp(file)
          .png({ quality: 80, compressionLevel: 9, palette: true })
          .toFile(outPath);
      } else if (ext === '.webp') {
        await sharp(file)
          .webp({ quality: 80 })
          .toFile(outPath);
      } else if (ext === '.svg') {
        // SVGを最適化
        const svgContent = fs.readFileSync(file, 'utf8');
        const result = optimize(svgContent, {
          multipass: true,
        });
        fs.writeFileSync(outPath, result.data);
      } else if (ext === '.gif') {
        // GIFはそのままコピー
        fs.copyFileSync(file, outPath);
        console.log(`${relPath}: コピーのみ（GIF圧縮スキップ）`);
        continue;
      }

      const compressedSize = fs.statSync(outPath).size;
      totalOriginal += originalSize;
      totalCompressed += compressedSize;
      count++;

      const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
      console.log(`${relPath}: ${originalSize} → ${compressedSize} Bytes (-${reduction}%)`);
    } catch (error) {
      console.error(`Error processing ${relPath}:`, error.message);
    }
  }

  if (totalOriginal > 0) {
    const totalReduction = ((totalOriginal - totalCompressed) / totalOriginal * 100).toFixed(1);
    console.log(`\n画像圧縮完了: ${count}枚 (合計: ${totalOriginal} → ${totalCompressed} Bytes, 削減率: -${totalReduction}%)`);
  } else {
    console.log('\n圧縮可能な画像が見つかりませんでした');
  }
}

compressImages();
