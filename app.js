const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const grid = document.getElementById("grid");
const chips = document.getElementById("chips");
const searchInput = document.getElementById("search");
const empty = document.getElementById("empty");
const subtitle = document.getElementById("subtitle");
const showFavsBtn = document.getElementById("showFavs");
const clearFavsBtn = document.getElementById("clearFavs");

const FAV_KEY = "series_hub_favorites_v1";

function loadFavs() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveFavs(favs) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
}
let favs = loadFavs();

let catalog = null;
let selectedCategory = "All";
let showFavsOnly = false;

async function init() {
  subtitle.textContent = "Loading…";
  const res = await fetch("./catalog.json", { cache: "no-store" });
  catalog = await res.json();

  buildChips(catalog.categories || ["All"]);
  subtitle.textContent = "Pick a bot to open";
  render();
}

function buildChips(categories) {
  chips.innerHTML = "";
  categories.forEach(cat => {
    const el = document.createElement("div");
    el.className = "chip" + (cat === selectedCategory ? " on" : "");
    el.textContent = cat;

    el.onclick = () => {
      selectedCategory = cat;
      updateChipUI();
      render();
      tg?.HapticFeedback?.impactOccurred("light");
    };

    chips.appendChild(el);
  });
}

function updateChipUI() {
  [...chips.children].forEach(ch => {
    ch.classList.toggle("on", ch.textContent === selectedCategory);
  });
}

function matchesFilters(item, q) {
  const text = `${item.name} ${item.desc} ${item.botUsername}`.toLowerCase();
  const okSearch = text.includes(q);
  const okCategory = (selectedCategory === "All") || (item.category === selectedCategory);
  const okFavs = !showFavsOnly || favs.has(item.id);
  return okSearch && okCategory && okFavs;
}

function render() {
  if (!catalog) return;

  const q = (searchInput.value || "").trim().toLowerCase();
  const items = (catalog.items || []).filter(item => matchesFilters(item, q));

  grid.innerHTML = "";
  empty.hidden = items.length !== 0;

  showFavsBtn.textContent = showFavsOnly ? "Showing favorites" : "Show favorites";

  items.forEach(item => grid.appendChild(makeCard(item)));
}

function makePoster(item, safeName) {
  // If you have a poster path in catalog.json, use <img>.
  // If it fails to load, we fallback to emoji poster (never show broken image).
  if (item.poster) {
    const frame = document.createElement("div");
    frame.className = "posterFrame";

    const img = document.createElement("img");
    img.className = "posterImg";
    img.src = item.poster;
    img.alt = `${safeName} poster`;
    img.loading = "lazy";

    img.onerror = () => {
      // replace with emoji fallback
      frame.replaceWith(makeEmojiPoster(item));
    };

    frame.appendChild(img);
    return frame;
  }
  return makeEmojiPoster(item);
}

function makeEmojiPoster(item) {
  const poster = document.createElement("div");
  poster.className = "poster";
  poster.textContent = item.emojiPoster || "🎞️";
  return poster;
}

function makeCard(item) {
  const card = document.createElement("div");
  card.className = "card";

  const isFav = favs.has(item.id);
  const safeName = escapeHtml(item.name);
  const safeDesc = escapeHtml(item.desc || "");
  const safeCat = escapeHtml(item.category || "Other");

  const newBadge = item.isNew ? `<span class="badge badge-new">New</span>` : "";
  const trendingBadge = item.isTrending ? `<span class="badge badge-trending">Trending</span>` : "";

  card.innerHTML = `
    <div class="cardTop">
      <div class="cardMeta">
        <div class="nameRow">
          <h3 class="name">${safeName}</h3>
          <button class="iconBtn" aria-label="favorite">${isFav ? "⭐" : "☆"}</button>
        </div>
        <div class="desc">${safeDesc}</div>
        <div class="badges">
          <span class="badge">${safeCat}</span>
          ${newBadge}
          ${trendingBadge}
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btnGhost join">Join channel</button>
      <button class="btn open">Open bot</button>
    </div>
  `;

  // Insert poster as the first element inside .cardTop
  const cardTop = card.querySelector(".cardTop");
  cardTop.insertBefore(makePoster(item, safeName), cardTop.firstChild);

  // Favorite
  card.querySelector(".iconBtn").onclick = () => {
    if (favs.has(item.id)) favs.delete(item.id);
    else favs.add(item.id);
    saveFavs(favs);
    tg?.HapticFeedback?.impactOccurred("light");
    render();
  };

  // Join channel
  card.querySelector(".join").onclick = () => {
    const chan = (item.joinChannel || "").trim().replace(/^@/, "");
    if (!chan) return popup("Missing channel", "Add joinChannel in catalog.json for this item.");
    openTelegram(`https://t.me/${encodeURIComponent(chan)}`);
  };

  // Open bot
  card.querySelector(".open").onclick = () => {
    const bot = (item.botUsername || "").trim().replace(/^@/, "");
    if (!bot) return popup("Missing bot", "Add botUsername in catalog.json for this item.");
    openTelegram(`https://t.me/${encodeURIComponent(bot)}?start=hub`);
  };

  return card;
}

function openTelegram(url) {
  try {
    tg?.openTelegramLink ? tg.openTelegramLink(url) : (window.location.href = url);
  } catch {
    window.location.href = url;
  }
}

function popup(title, message) {
  if (tg?.showPopup) tg.showPopup({ title, message, buttons: [{ type: "ok" }] });
  else alert(`${title}\n\n${message}`);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

searchInput.addEventListener("input", () => render());

showFavsBtn.addEventListener("click", () => {
  showFavsOnly = !showFavsOnly;
  tg?.HapticFeedback?.impactOccurred("light");
  render();
});

clearFavsBtn.addEventListener("click", () => {
  favs = new Set();
  saveFavs(favs);
  showFavsOnly = false;
  tg?.HapticFeedback?.notificationOccurred("success");
  render();
});

init();
