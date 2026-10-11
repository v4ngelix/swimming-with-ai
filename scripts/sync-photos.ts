// Adds any image in a location's assets folder (assets/<location id>/) that data/photos.ts doesn't know about yet.
// New entries get the current package.json version, which the wall marks as "new".
// Non-WebP images are converted to WebP first and the originals deleted; entries keep their metadata.
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import sharp from 'sharp';
import locations from '../data/locations.ts';
import photos from '../data/photos.ts';
import type { Config, Photo } from '../types.ts';

const IMAGE_EXT = /\.(png|jpe?g|webp|avif|gif)$/i;
const CONVERT_EXT = /\.(png|jpe?g|avif|gif)$/i;
const WEBP_QUALITY = 80;

const readJSON = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8'));

const { version } = readJSON<{ version: string }>('package.json');
const config = readJSON<Config>('config.json');

const assetsRoot = (config.assetsDir || 'assets').replace(/\/+$/, '');
const byLocation = { ...photos };
let changed = false;

for (const [id, location] of Object.entries(locations)) {
  const assetsDir = `${assetsRoot}/${id}`;
  const listed = byLocation[id] || [];

  if (!existsSync(assetsDir)) {
    console.warn(`${location.title}: no ${assetsDir}/ folder, skipping.`);
    continue;
  }

  for (const file of readdirSync(assetsDir).filter((file) => CONVERT_EXT.test(file))) {
    const webp = file.replace(CONVERT_EXT, '.webp');
    if (existsSync(`${assetsDir}/${webp}`)) {
      console.warn(`  ! ${assetsDir}/${webp} already exists, keeping ${file} unconverted`);
      continue;
    }
    try {
      // rotate() bakes in EXIF orientation, which WebP output would otherwise drop
      await sharp(`${assetsDir}/${file}`, { animated: true }).rotate().webp({ quality: WEBP_QUALITY }).toFile(`${assetsDir}/${webp}`);
    } catch (error) {
      console.warn(`  ! could not convert ${assetsDir}/${file}: ${(error as Error).message}`);
      continue;
    }
    unlinkSync(`${assetsDir}/${file}`);
    console.log(`${location.title}: converted ${file} -> ${webp}`);
    for (const photo of listed) {
      if (photo.file === file) { photo.file = webp; changed = true; }
    }
  }

  const known = new Set(listed.map((photo) => photo.file));
  const files = readdirSync(assetsDir).filter((file) => IMAGE_EXT.test(file));
  const added = files
    .filter((file) => !known.has(file))
    .map((file): Photo => ({ file, title: file.replace(IMAGE_EXT, ''), version, links: {} }));

  // width/height let the wall reserve space before images load
  for (const photo of [...listed, ...added]) {
    if (photo.width && photo.height || !files.includes(photo.file)) continue;
    const { width, height } = await sharp(`${assetsDir}/${photo.file}`).metadata();
    Object.assign(photo, { width, height });
    changed = true;
  }

  const missing = listed.filter((photo) => !files.includes(photo.file));

  if (added.length) {
    byLocation[id] = [...listed, ...added].sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
    changed = true;
    console.log(`${location.title}: added ${added.length} photo(s) at version ${version}:`);
    for (const photo of added) console.log(`  + ${photo.file}`);
  } else {
    console.log(`${location.title}: no new photos in ${assetsDir}/.`);
  }

  for (const photo of missing) {
    console.warn(`  ! ${photo.file} is listed in data/photos.ts but not in ${assetsDir}/`);
  }
}

// written as JSON with bare keys, so hand edits (links, favourites) survive regeneration; comments don't
const toSource = (byLocation: Record<string, Photo[]>) =>
  `import type { Photo } from '../types.ts';\n\n` +
  `const photos: Record<string, Photo[]> = ${JSON.stringify(byLocation, null, 2).replace(/^(\s*)"(\w+)":/gm, '$1$2:')};\n\n` +
  'export default photos;\n';

if (changed) writeFileSync('data/photos.ts', toSource(byLocation));
