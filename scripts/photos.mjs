// Adds any image in a location's assets folder (assets/<location id>/) that photos.json doesn't know about yet.
// New entries get the current package.json version, which the wall marks as "new".
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import locations from '../locations.js';

const IMAGE_EXT = /\.(png|jpe?g|webp|avif|gif)$/i;

const readJSON = (path) => JSON.parse(readFileSync(path, 'utf8'));

const { version } = readJSON('package.json');
const config = readJSON('config.json');
const data = readJSON('photos.json');

const assetsRoot = (config.assetsDir || 'assets').replace(/\/+$/, '');
const byLocation = data.photos || {};
let changed = false;

for (const [id, location] of Object.entries(locations)) {
  const assetsDir = `${assetsRoot}/${id}`;
  const photos = byLocation[id] || [];

  if (!existsSync(assetsDir)) {
    console.warn(`${location.title}: no ${assetsDir}/ folder, skipping.`);
    continue;
  }

  const known = new Set(photos.map((photo) => photo.file));
  const files = readdirSync(assetsDir).filter((file) => IMAGE_EXT.test(file));
  const added = files
    .filter((file) => !known.has(file))
    .map((file) => ({ file, title: file.replace(IMAGE_EXT, ''), version, links: {} }));

  const missing = photos.filter((photo) => !files.includes(photo.file));

  if (added.length) {
    byLocation[id] = [...photos, ...added].sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
    changed = true;
    console.log(`${location.title}: added ${added.length} photo(s) at version ${version}:`);
    for (const photo of added) console.log(`  + ${photo.file}`);
  } else {
    console.log(`${location.title}: no new photos in ${assetsDir}/.`);
  }

  for (const photo of missing) {
    console.warn(`  ! ${photo.file} is listed in photos.json but not in ${assetsDir}/`);
  }
}

if (changed) writeFileSync('photos.json', `${JSON.stringify({ ...data, photos: byLocation }, null, 2)}\n`);
