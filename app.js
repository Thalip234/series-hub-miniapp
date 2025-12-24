// ====== Telegram WebApp (safe usage) ======
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand(); // open bigger height

// ====== DOM elements ======
const grid = document.getElementById("grid");
const chips = document.getElementById("chips");
const searchInput = document.getElementById("search");
const empty = document.getElementById("empty");
const subtitle = document.getElementById("subtitle");
const showFavsBtn = document.getElementById("showFavs");
const clearFavsBtn = document.getElementById("clearFavs");

// ====== Favorites storage ======
const FAV_KEY = "series_hub_favorites_v1";
function loadFavs() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveFavs(favs) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
}
let favs = loadFavs();

// ====== App state ======
let catalog = null;
let selectedCategory = "All";
let showFavsOnly = false;

// ====== Load catalog.json ======
async function init() {
  subtitle.textContent = "Loading…";
  const res = await fetch("./catalog.json", { cache: "no-store" });
  catalog = await res.json();

  // Build category chips
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
      // turn off "favorites only" if you change category? (your choice)
      // showFavsOnly = false;
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
  // Search
  const text = `${item.name} ${item.desc} ${item.botUsername}`.toLowerCase();
  const okSearch = text.includes(q);

  // Category
  const okCategory = (selectedCategory === "All") || (item.category === selectedCategory);

  // Favorites-only mode
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

  items.forEach(item => {
    grid.appendChild(makeCard(item));
  });
}

function makeCard(item) {
  const card = document.createElement("div");
  card.className = "card";

  const isFav = favs.has(item.id);

  card.innerHTML = `
    <div class="cardTop">
      <div class="poster">${escapeHtml(item.emojiPoster || "🎞️")}</div>
      <div class="cardMeta">
        <div class="nameRow">
          <h3 class="name">${escapeHtml(item.name)}</h3>
          <button class="iconBtn" aria-label="favorite">${isFav ? "⭐" : "☆"}</button>
        </div>
        <div class="desc">${escapeHtml(item.desc || "")}</div>
        <div class="badges">
          <span class="badge">${escapeHtml(item.category || "Other")}</span>
          ${item.isNew ? `<span class="badge">New</span>` : ""}
          ${item.isTrending ? `<span class="badge">Trending</span>` : ""}
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btnGhost join">Join channel</button>
      <button class="btn open">Open bot</button>
    </div>
  `;

  // Favorite button
  const favBtn = card.querySelector(".iconBtn");
  favBtn.onclick = () => {
    if (favs.has(item.id)) favs.delete(item.id);
    else favs.add(item.id);

    saveFavs(favs);
    tg?.HapticFeedback?.impactOccurred("light");
    render(); // rerender to update stars
  };

  // Join channel button
  const joinBtn = card.querySelector(".join");
  joinBtn.onclick = () => {
    const chan = (item.joinChannel || "").trim().replace(/^@/, "");
    if (!chan) return popup("Missing channel", "Add joinChannel in catalog.json for this item.");
    openTelegram(`https://t.me/${encodeURIComponent(chan)}`);
  };

  // Open bot button
  const openBtn = card.querySelector(".open");
  openBtn.onclick = () => {
    const bot = (item.botUsername || "").trim().replace(/^@/, "");
    if (!bot) return popup("Missing bot", "Add botUsername in catalog.json for this item.");

    // Optional: add a start param so your bot knows user came from the hub
    // If you don't want it, remove "?start=hub" part.
    openTelegram(`https://t.me/${encodeURIComponent(bot)}?start=hub`);
  };

  return card;
}

// Use Telegram WebApp method if available, fallback to normal link
function openTelegram(url) {
  try {
    // Telegram WebApp API supports opening links / telegram links (so it feels native)
    tg?.openTelegramLink ? tg.openTelegramLink(url) : window.location.href = url;
  } catch {
    window.location.href = url;
  }
}

function popup(title, message) {
  if (tg?.showPopup) {
    tg.showPopup({ title, message, buttons: [{ type: "ok" }] });
  } else {
    alert(`${title}\n\n${message}`);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ====== events ======
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
