import locations from './data/locations.ts';
import photosByPlace from './data/photos.ts';
import type { Button, Config, Location, Photo } from './types.ts';

declare const __APP_VERSION__: string | undefined;

type Place = Location & { id: string };

(async function () {
  // replaced at build time by vite's `define`; empty when the page runs without vite
  const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';

  const wall = document.getElementById('wall')!;
  const message = document.getElementById('message')!;

  const fail = (html: string) => {
    message.innerHTML = html;
    message.hidden = false;
  };

  const getJSON = async <T>(url: string): Promise<T> => {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
  };

  let config: Config;
  try {
    config = await getJSON<Config>('config.json');
  } catch (err) {
    fail(`Could not load the config (${(err as Error).message}).<br>` +
         `Start the dev server with <code>npm run dev</code> — ` +
         `opening index.html straight from disk blocks the JSON file.`);
    return;
  }

  const assetsRoot = (config.assetsDir || 'assets').replace(/\/+$/, '');
  const buttons = config.buttons || [];
// TODO
  // newest place first (data/locations.ts lists them oldest first)
  const places: Place[] = Object.entries(locations).map(([id, place]) => ({ id, ...place })).reverse();

  // url-safe photo name: "Coris julis" -> "coris-julis"
  const slug = (title: string) => title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // ?location=<place url>&photo=<photo slug>, so a copied url reopens the same view
  const setUrl = (place: Place, photo?: Photo | null) => {
    const params = new URLSearchParams({ location: place.url });
    if (photo) params.set('photo', slug(photo.title));
    history.replaceState(null, '', `?${params}`);
  };

  // A button's link comes from the photo's own `links` map, falling back to the
  // button's urlTemplate. An explicit empty string hides the button for that photo.
  const resolveUrl = (photo: Photo, button: Button) => {
    const own = photo.links && photo.links[button.id];
    if (own !== undefined) return own;
    if (!button.urlTemplate) return '';
    return button.urlTemplate
      .replace(/{title_underscore}/g, encodeURIComponent(photo.title.replace(/ /g, '_')))
      .replace(/{title}/g, encodeURIComponent(photo.title));
  };

  const buildFigure = (photo: Photo, assetsDir: string) => {
    const figure = document.createElement('figure');
    figure.tabIndex = 0;

    const img = document.createElement('img');
    img.src = `${assetsDir}/${encodeURIComponent(photo.file)}`;
    img.alt = photo.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    if (photo.width && photo.height) { img.width = photo.width; img.height = photo.height; }
    img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
    figure.appendChild(img);

    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    figure.appendChild(scrim);

    const badges = document.createElement('div');
    badges.className = 'badges';
    if (photo.favourite === true) {
      const star = document.createElement('span');
      star.className = 'badge-favourite';
      star.title = 'Favourite';
      star.setAttribute('aria-label', star.title);
      star.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>';
      badges.appendChild(star);
    }
    if (photo.version && photo.version === APP_VERSION) {
      const badge = document.createElement('span');
      badge.className = 'badge-latest';
      badge.textContent = 'latest';
      badges.appendChild(badge);
    }
    if (badges.children.length) figure.appendChild(badges);

    const actions = document.createElement('div');
    actions.className = 'actions';
    for (const button of buttons) {
      const url = resolveUrl(photo, button);
      if (!url) continue;
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = `${button.label || button.id} — ${photo.title}`;
      a.setAttribute('aria-label', a.title);
      a.innerHTML = button.icon || '';
      actions.appendChild(a);
    }
    if (actions.children.length) figure.appendChild(actions);

    const caption = document.createElement('figcaption');
    caption.textContent = photo.title;
    figure.appendChild(caption);

    return figure;
  };

  let current: { place: Place | null; figure: HTMLElement | null } = { place: null, figure: null };

  // clicking the selected photo again clears the selection
  const select = (figure: HTMLElement, photo: Photo) => {
    if (current.figure) current.figure.classList.remove('selected');
    const same = current.figure === figure;
    current.figure = same ? null : figure;
    if (!same) figure.classList.add('selected');
    setUrl(current.place!, same ? null : photo);
  };

  const render = (place: Place, photoSlug?: string | null) => {
    current = { place, figure: null };
    wall.replaceChildren();
    message.hidden = true;

    const photos = photosByPlace[place.id] || [];
    if (!photos.length) {
      fail(`No photos yet. Drop images into <code>${assetsRoot}/${place.id}/</code> and run <code>npm run sync-photos</code>.`);
      setUrl(place);
      return;
    }

    const frag = document.createDocumentFragment();
    let preselected: { figure: HTMLElement; photo: Photo } | null = null;
    for (const photo of photos) {
      const figure = buildFigure(photo, `${assetsRoot}/${place.id}`);
      figure.addEventListener('click', (e) => { if (!(e.target as Element).closest('a')) select(figure, photo); });
      figure.addEventListener('keydown', (e) => {
        if (e.target === figure && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(figure, photo); }
      });
      if (photoSlug && slug(photo.title) === photoSlug) preselected = { figure, photo };
      frag.appendChild(figure);
    }
    wall.appendChild(frag);

    if (preselected) {
      select(preselected.figure, preselected.photo);
      preselected.figure.scrollIntoView({ block: 'center' });
    } else {
      setUrl(place);
    }
  };

  // one tag per place; the pressed tag marks the place on show
  const tags = document.getElementById('places')!;
  const show = (place: Place, photoSlug?: string | null) => {
    for (const tag of tags.children as HTMLCollectionOf<HTMLElement>) tag.setAttribute('aria-pressed', String(tag.dataset.url === place.url));
    render(place, photoSlug);
  };
  for (const place of places) {
    const tag = document.createElement('button');
    tag.type = 'button';
    tag.className = 'eyebrow';
    tag.textContent = place.title;
    tag.dataset.url = place.url;
    tag.addEventListener('click', () => { if (place !== current.place) show(place); });
    tags.appendChild(tag);
  }

  // unknown or missing ?location= falls back to the newest place
  const params = new URLSearchParams(window.location.search);
  const initial = places.find((place) => place.url === params.get('location')) || places[0];
  show(initial, params.get('photo'));
})();
