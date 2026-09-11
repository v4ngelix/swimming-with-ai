// Adds any image in the assets folder that photos.json doesn't know about yet.
// New entries get the current package.json version, which the wall marks as "new".
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const IMAGE_EXT = /\.(png|jpe?g|webp|avif|gif)$/i;

const readJSON = (path) => JSON.parse(readFileSync(path, 'utf8'));

const { version } = readJSON('package.json');
const config = readJSON('config.json');
const data = readJSON('photos.json');

const assetsDir = (config.assetsDir || 'assets').replace(/\/+$/, '');
const photos = data.photos || [];
const known = new Set(photos.map((photo) => photo.file));

const files = readdirSync(assetsDir).filter((file) => IMAGE_EXT.test(file));
const added = files
  .filter((file) => !known.has(file))
  .map((file) => ({ file, title: file.replace(IMAGE_EXT, ''), version, links: {} }));

const missing = photos.filter((photo) => !files.includes(photo.file));

if (added.length) {
  const next = [...photos, ...added].sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
  writeFileSync('photos.json', `${JSON.stringify({ ...data, photos: next }, null, 2)}\n`);
  console.log(`Added ${added.length} photo(s) at version ${version}:`);
  for (const photo of added) console.log(`  + ${photo.file}`);
} else {
  console.log(`No new photos in ${assetsDir}/.`);
}

for (const photo of missing) {
  console.warn(`  ! ${photo.file} is listed in photos.json but not in ${assetsDir}/`);
}
