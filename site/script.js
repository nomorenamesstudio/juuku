const THEMES = ['mocha', 'modern', 'geek'];
const NAMES = { mocha: 'Mocha', modern: 'Modern', geek: 'Geek' };
// the app's own page color, so a phone's browser chrome follows the theme
const PAGE = { mocha: '#14100b', modern: '#0e1213', geek: '#05070a' };

// two pickers share one state: the dropdown in the bar and the theme cards in the
// themes section
const select = document.querySelector('[data-theme-select]');
const groups = [...document.querySelectorAll('[role="radiogroup"]')].map((group) => [
  ...group.querySelectorAll('[data-set-theme]'),
]);
const radios = groups.flat();
// a phone gets the phone app in the hero, not a shrunken desktop window
const narrow = window.matchMedia('(max-width: 44rem)');
const shotName = (shot) => (narrow.matches && shot.dataset.shotNarrow ? shot.dataset.shotNarrow : shot.dataset.shot);
const shots = [...document.querySelectorAll('[data-shot]')];
const iconSets = [...document.querySelectorAll('.ic')];
const names = [...document.querySelectorAll('[data-theme-name]')];
const metaColor = document.querySelector('meta[name="theme-color"]');

let current = THEMES.includes(document.documentElement.dataset.theme)
  ? document.documentElement.dataset.theme
  : 'mocha';

function apply(theme) {
  current = theme;
  document.documentElement.dataset.theme = theme;
  if (select) select.value = theme;
  for (const radio of radios) radio.setAttribute('aria-checked', String(radio.dataset.setTheme === theme));
  for (const name of names) name.textContent = NAMES[theme];
  for (const shot of shots) {
    const src = `images/${theme}/${shotName(shot)}.jpg`;
    if (shot.getAttribute('src') !== src) shot.setAttribute('src', src);
    if (shot.dataset.altNarrow) {
      shot.setAttribute('alt', narrow.matches ? shot.dataset.altNarrow : shot.dataset.altWide);
    }
  }
  // one glyph per slot, enforced here as well as in CSS: a stale stylesheet must
  // not be able to stack all three sets inside a button
  for (const icon of iconSets) {
    icon.style.display = icon.classList.contains(`ic-${theme}`) ? '' : 'none';
  }
  if (metaColor) metaColor.setAttribute('content', PAGE[theme]);
  try {
    localStorage.setItem('juuku.theme', theme);
  } catch {
    // private mode: the session keeps the theme
  }
}

if (select) select.addEventListener('change', () => apply(select.value));

for (const radio of radios) {
  radio.addEventListener('click', () => apply(radio.dataset.setTheme));
  // the radiogroup pattern: arrows move the selection, not just the focus
  radio.addEventListener('keydown', (event) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    const siblings = groups.find((group) => group.includes(radio)) ?? radios;
    event.preventDefault();
    const next = siblings[(siblings.indexOf(radio) + step + siblings.length) % siblings.length];
    next.focus();
    apply(next.dataset.setTheme);
  });
}

apply(current);
document.documentElement.removeAttribute('data-pending');
// crossing the breakpoint swaps the hero shot, so repaint then
narrow.addEventListener('change', () => apply(current));

// the other two sets are only needed once someone asks for them: fetch them while
// the browser is idle so the switch is instant instead of a black flash
const warm = () => {
  for (const theme of THEMES) {
    if (theme === current) continue;
    for (const shot of shots) {
      const img = new Image();
      img.src = `images/${theme}/${shotName(shot)}.jpg`;
    }
  }
};
if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 });
else setTimeout(warm, 2500);

// the run card has one panel per install route, and the copy button follows the
// visible one
const tabs = [...document.querySelectorAll('[data-tab]')];
const panels = tabs.map((tab) => document.getElementById(tab.dataset.tab));
for (const tab of tabs) {
  tab.addEventListener('click', () => {
    for (const [index, other] of tabs.entries()) {
      const on = other === tab;
      other.setAttribute('aria-selected', String(on));
      other.tabIndex = on ? 0 : -1;
      panels[index].hidden = !on;
    }
  });
  tab.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
    next.focus();
    next.click();
  });
}

// copy an address instead of opening a mail client, with one transient confirmation
const toast = document.getElementById('toast');
const toastMessage = document.querySelector('[data-toast-message]');
let toastTimer;
function showToast(message) {
  if (!toast || !toastMessage) return;
  toastMessage.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

for (const link of document.querySelectorAll('a[data-copy]')) {
  link.addEventListener('click', async (event) => {
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(link.dataset.copy);
    } catch {
      showToast('Could not copy — please copy it manually.');
      return;
    }
    showToast('Copied the email to your clipboard.');
  });
}

const copy = document.querySelector('[data-copy]:not(a)');
const activeCommand = () => panels.find((panel) => !panel.hidden)?.querySelector('code') ?? null;
if (copy && panels.length) {
  copy.addEventListener('click', async () => {
    const text = activeCommand()?.textContent ?? '';
    let ok = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      ok = false;
    }
    if (!ok) {
      const field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.append(field);
      field.select();
      ok = document.execCommand('copy');
      field.remove();
    }
    const label = copy.querySelector('[data-copy-label]');
    copy.toggleAttribute('data-copied', ok);
    if (label) label.textContent = ok ? 'Copied' : 'Select it';
    setTimeout(() => {
      copy.removeAttribute('data-copied');
      if (label) label.textContent = 'Copy';
    }, 1800);
  });
}

// screenshots: one slide at a time, auto-advancing with a progress bar per slide
const gallery = document.querySelector('[data-gallery]');

if (gallery) {
  const track = gallery.querySelector('[data-gtrack]');
  const viewport = gallery.querySelector('[data-gviewport]');
  const barRow = gallery.querySelector('[data-gbars]');
  const slides = [...gallery.querySelectorAll('[data-slide]')];
  const bars = [...gallery.querySelectorAll('[data-gbar]')];
  const DURATION = 6500;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let index = 0;
  let elapsed = 0;
  let stamp = 0;
  let paused = false;
  let visible = true;

  function render(next) {
    index = (next + slides.length) % slides.length;
    track.style.transform = `translateX(${-index * 100}%)`;
    slides.forEach((slide, n) => slide.setAttribute('aria-hidden', String(n !== index)));
    bars.forEach((bar, n) => {
      const active = n === index;
      bar.setAttribute('aria-selected', String(active));
      bar.classList.toggle('is-active', active);
      bar.classList.toggle('is-done', n < index);
      bar.firstElementChild.style.width = active ? '0%' : n < index ? '100%' : '0%';
    });
    elapsed = 0;
    stamp = performance.now();
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (paused || !visible || document.hidden) {
      stamp = now;
      return;
    }
    elapsed += now - stamp;
    stamp = now;
    const fill = bars[index].firstElementChild;
    fill.style.width = `${Math.min(100, (elapsed / DURATION) * 100)}%`;
    if (elapsed >= DURATION) render(index + 1);
  }

  bars.forEach((bar, n) => bar.addEventListener('click', () => render(n)));

  barRow.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + slides.length) % slides.length;
    render(next);
    bars[next].focus();
  });

  // hold the timer while he is looking at one slide
  gallery.addEventListener('pointerenter', () => (paused = true));
  gallery.addEventListener('pointerleave', () => {
    paused = false;
    stamp = performance.now();
  });
  gallery.addEventListener('focusin', () => (paused = true));
  gallery.addEventListener('focusout', () => {
    paused = false;
    stamp = performance.now();
  });

  // a swipe is a slide
  let startX = null;
  viewport.addEventListener('pointerdown', (event) => (startX = event.clientX));
  viewport.addEventListener('pointerup', (event) => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) render(index + (dx < 0 ? 1 : -1));
  });

  // no timer for a carousel nobody can see
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        stamp = performance.now();
      },
      { threshold: 0.25 },
    ).observe(gallery);
  }

  render(0);
  if (!still) requestAnimationFrame(tick);
}
