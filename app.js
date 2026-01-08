const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const grid = document.getElementById("grid");
const chips = document.getElementById("chips");
const searchInput = document.getElementById("search");
const empty = document.getElementById("empty");
const subtitle = document.getElementById("subtitle");
const versionEl = document.getElementById("version");
const showFavsBtn = document.getElementById("showFavs");
const clearFavsBtn = document.getElementById("clearFavs");

/* Modal refs */
const modal = document.getElementById("modal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const modalPoster = document.getElementById("modalPoster");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalBadges = document.getElementById("modalBadges");
const modalIntro = document.getElementById("modalIntro");
const modalPrimary = document.getElementById("modalPrimary");
const modalSecondary = document.getElementById("modalSecondary");

const FAV_KEY = "series_hub_favorites_v1";
const UNLOCK_KEY = "series_hub_unlocked_v1"; // local “joined/unlocked” memory

function loadSet(key){
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); }
  catch { return new Set(); }
}
function saveSet(key, set){
  localStorage.setItem(key, JSON.stringify([...set]));
}

let favs = loadSet(FAV_KEY);
let unlocked = loadSet(UNLOCK_KEY);

let catalog = null;
let selectedCategory = "All";
let showFavsOnly = false;
let currentModalItem = null;

/* ===== Utilities ===== */
function haptic(type="light"){
  try{
    if (!tg?.HapticFeedback) return;
    if (type === "light") tg.HapticFeedback.impactOccurred("light");
    else if (type === "medium") tg.HapticFeedback.impactOccurred("medium");
    else if (type === "success") tg.HapticFeedback.notificationOccurred("success");
    else if (type === "error") tg.HapticFeedback.notificationOccurred("error");
  }catch{}
}

function popup(title, message){
  if (tg?.showPopup) tg.showPopup({ title, message, buttons: [{ type: "ok" }] });
  else alert(`${title}\n\n${message}`);
}

function openTelegram(url){
  try { tg?.openTelegramLink ? tg.openTelegramLink(url) : (window.location.href = url); }
  catch { window.location.href = url; }
}

function esc(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function getJoinLink(item){
  const chan = (item.joinChannel || "").trim().replace(/^@/,"");
  return chan ? `https://t.me/${encodeURIComponent(chan)}` : "";
}
function getBotLink(item){
  const bot = (item.botUsername || "").trim().replace(/^@/,"");
  return bot ? `https://t.me/${encodeURIComponent(bot)}?start=hub` : "";
}

function isLocked(item){
  return !!item.locked || !!item.comingSoon || !item.botUsername;
}

/* ===== Cinematic Modal ===== */
function closeModal(){
  if (modal.hidden) return;
  modal.classList.remove("show");
  setTimeout(() => { modal.hidden = true; }, 220);
  currentModalItem = null;
}

function setPoster(container, item, titleText){
  container.innerHTML = "";
  if (item.poster){
    const img = document.createElement("img");
    img.src = item.poster;
    img.alt = `${titleText} poster`;
    img.loading = "lazy";
    img.onerror = () => { container.textContent = item.emojiPoster || "🎞️"; };
    container.appendChild(img);
  } else {
    container.textContent = item.emojiPoster || "🎞️";
  }
}

function openModal(item){
  currentModalItem = item;

  const titleText = item.name || "Series";
  modalTitle.textContent = titleText;

  const s = Number(item.seasons || 0);
  const e = Number(item.episodes || 0);
  const metaBits = [];
  if (s) metaBits.push(`${s} season${s === 1 ? "" : "s"}`);
  if (e) metaBits.push(`${e} ep${e === 1 ? "" : "s"}`);
  if (item.category) metaBits.push(item.category);
  modalMeta.textContent = metaBits.join(" • ") || "Preview";

  modalBadges.innerHTML = "";
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const badges = [item.category, ...tags].filter(Boolean).slice(0, 5);
  badges.forEach(t => {
    const span = document.createElement("span");
    span.className = "badge";
    span.textContent = t;
    modalBadges.appendChild(span);
  });
  if (item.isNew){
    const b = document.createElement("span");
    b.className = "badge badge-new";
    b.textContent = "New";
    modalBadges.appendChild(b);
  }
  if (item.isTrending){
    const b = document.createElement("span");
    b.className = "badge badge-trending";
    b.textContent = "Trending";
    modalBadges.appendChild(b);
  }

  modalIntro.textContent = item.intro || item.desc || "No description yet.";

  setPoster(modalPoster, item, titleText);

  // Smart buttons
  const locked = isLocked(item);
  const joined = unlocked.has(item.id);
  const joinLink = getJoinLink(item);
  const botLink = getBotLink(item);

  if (locked){
    modalPrimary.textContent = item.lockReason || "Coming soon";
    modalPrimary.disabled = true;
    modalSecondary.textContent = "Channel";
    modalSecondary.disabled = !joinLink;
  } else if (!joined){
    modalPrimary.textContent = "Unlock";
    modalPrimary.disabled = !joinLink;
    modalSecondary.textContent = "Watch now";
    modalSecondary.disabled = !botLink;
  } else {
    modalPrimary.textContent = "Watch now";
    modalPrimary.disabled = !botLink;
    modalSecondary.textContent = "Channel";
    modalSecondary.disabled = !joinLink;
  }

  modalPrimary.onclick = () => {
    haptic("medium");
    if (locked) return;

    if (!joined){
      if (!joinLink) return popup("No channel set", "This series needs a channel link to unlock.");
      unlocked.add(item.id);
      saveSet(UNLOCK_KEY, unlocked);
      openTelegram(joinLink);
      popup("Unlocked ✅", "After joining, come back and tap Watch now.");
      render(true);
      return;
    }

    if (!botLink) return popup("Missing bot", "botUsername is missing for this series.");
    openTelegram(botLink);
  };

  modalSecondary.onclick = () => {
    haptic("light");
    if (!joined && !locked){
      // allow direct watch, but warn
      if (!botLink) return;
      popup("Tip", "For full access, tap Unlock and join the channel first.");
      openTelegram(botLink);
      return;
    }
    if (!joinLink) return;
    openTelegram(joinLink);
  };

  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add("show"));
  haptic("light");
}

/* ===== Render with smooth reorder (FLIP) ===== */
function getRectMap(){
  const map = new Map();
  [...grid.children].forEach(el => {
    const id = el.getAttribute("data-id");
    if (id) map.set(id, el.getBoundingClientRect());
  });
  return map;
}

function animateReorder(prevRects){
  const nextRects = getRectMap();
  [...grid.children].forEach(el => {
    const id = el.getAttribute("data-id");
    const prev = prevRects.get(id);
    const next = nextRects.get(id);
    if (!prev || !next) return;

    const dx = prev.left - next.left;
    const dy = prev.top - next.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: "translate(0, 0)" }
      ],
      { duration: 220, easing: "cubic-bezier(.2,.9,.2,1)" }
    );
  });
}

/* ===== Long-press actions ===== */
function attachLongPress(cardEl, item){
  let timer = null;
  let moved = false;

  const start = () => {
    moved = false;
    timer = setTimeout(() => {
      haptic("medium");
      showActionPopup(item);
    }, 480);
  };
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  cardEl.addEventListener("touchstart", start, { passive: true });
  cardEl.addEventListener("touchmove", () => { moved = true; cancel(); }, { passive: true });
  cardEl.addEventListener("touchend", () => { if (!moved) cancel(); }, { passive: true });
  cardEl.addEventListener("touchcancel", cancel, { passive: true });

  // desktop fallback
  cardEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showActionPopup(item);
  });
}

function showActionPopup(item){
  const isFav = favs.has(item.id);
  const locked = isLocked(item);
  const joined = unlocked.has(item.id);

  // ✅ Hide favorites actions for comingSoon cards (prevents clash + keeps it clean)
  const allowFavActions = !item.comingSoon;

  const buttons = [
    { id: "preview", type: "default", text: "Preview" },
    ...(allowFavActions ? [{ id: "fav", type: "default", text: isFav ? "Remove favorite" : "Add favorite" }] : []),
    { id: "share", type: "default", text: "Share" },
    { id: "close", type: "cancel", text: "Close" }
  ];

  tg?.showPopup?.({
    title: item.name || "Series",
    message: locked ? (item.lockReason || "Coming soon") : (joined ? "Unlocked" : "Locked (tap Unlock)"),
    buttons
  }, (btnId) => {
    if (btnId === "preview") openModal(item);
    if (btnId === "fav" && allowFavActions){
      if (favs.has(item.id)) favs.delete(item.id);
      else favs.add(item.id);
      saveSet(FAV_KEY, favs);
      haptic("success");
      render(true);
    }
    if (btnId === "share"){
      const botLink = getBotLink(item);
      if (!botLink) return haptic("error");
      // simplest share: copy to clipboard + popup
      navigator.clipboard?.writeText(botLink).then(() => {
        haptic("success");
        popup("Copied", "Bot link copied. Paste it anywhere.");
      }).catch(() => {
        popup("Link", botLink);
      });
    }
  });
}

/* ===== App logic ===== */
async function init(){
  // brand language + version
  versionEl.textContent = "v1.0 •";

  subtitle.textContent = "Loading…";
  const res = await fetch("./catalog.json", { cache: "no-store" });
  catalog = await res.json();

  buildChips(catalog.categories || ["All"]);
  subtitle.textContent = "Browse • Preview • Watch";
  render(false);
}

function buildChips(categories){
  chips.innerHTML = "";
  categories.forEach(cat => {
    const el = document.createElement("div");
    el.className = "chip" + (cat === selectedCategory ? " on" : "");
    el.textContent = cat;

    el.onclick = () => {
      haptic("light");
      selectedCategory = cat;
      updateChipUI();
      render(true);
    };

    chips.appendChild(el);
  });
}

function updateChipUI(){
  [...chips.children].forEach(ch => ch.classList.toggle("on", ch.textContent === selectedCategory));
}

function matchesFilters(item, q){
  const text = `${item.name} ${item.desc} ${item.botUsername} ${(item.tags || []).join(" ")} ${item.category}`.toLowerCase();
  const okSearch = text.includes(q);
  const okCategory = (selectedCategory === "All") || (item.category === selectedCategory);
  const okFavs = !showFavsOnly || favs.has(item.id);
  return okSearch && okCategory && okFavs;
}

function makePosterNode(item){
  if (item.poster){
    const frame = document.createElement("div");
    frame.className = "posterFrame";
    const img = document.createElement("img");
    img.className = "posterImg";
    img.src = item.poster;
    img.alt = `${item.name} poster`;
    img.loading = "lazy";
    img.onerror = () => { frame.replaceWith(makeEmojiPoster(item)); };
    frame.appendChild(img);
    return frame;
  }
  return makeEmojiPoster(item);
}

function makeEmojiPoster(item){
  const p = document.createElement("div");
  p.className = "poster";
  p.textContent = item.emojiPoster || "🎞️";
  return p;
}

function render(animate){
  if (!catalog) return;

  const prevRects = animate ? getRectMap() : null;

  const q = (searchInput.value || "").trim().toLowerCase();
  const items = (catalog.items || []).filter(it => matchesFilters(it, q));

  grid.innerHTML = "";
  empty.hidden = items.length !== 0;
  showFavsBtn.textContent = showFavsOnly ? "Showing favorites" : "Show favorites";

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "card" + (isLocked(item) ? " locked" : "");
    card.setAttribute("data-id", item.id);

    // structure
    const top = document.createElement("div");
    top.className = "cardTop";
    top.appendChild(makePosterNode(item));

    const meta = document.createElement("div");
    meta.className = "cardMeta";

    const nameRow = document.createElement("div");
    nameRow.className = "nameRow";

    const name = document.createElement("h3");
    name.className = "name";
    name.innerHTML = esc(item.name || "Series");

    // ✅ Hide favorite icon ONLY for comingSoon cards (prevents clash with badge)
    let favBtn = null;
    if (!item.comingSoon){
      favBtn = document.createElement("button");
      favBtn.className = "iconBtn";
      favBtn.setAttribute("aria-label", "favorite");
      favBtn.textContent = favs.has(item.id) ? "⭐" : "☆";
      nameRow.appendChild(name);
      nameRow.appendChild(favBtn);
    } else {
      nameRow.appendChild(name);
    }

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = item.desc || "";

    const previewLine = document.createElement("div");
    previewLine.className = "previewLine";
    const s = Number(item.seasons || 0);
    const e = Number(item.episodes || 0);
    previewLine.textContent = (s || e) ? `${s ? `${s} season${s===1?"":"s"}` : ""}${(s && e) ? " • " : ""}${e ? `${e} episodes` : ""}` : "";

    const badges = document.createElement("div");
    badges.className = "badges";

    const bCat = document.createElement("span");
    bCat.className = "badge";
    bCat.textContent = item.category || "Other";
    badges.appendChild(bCat);

    if (item.isNew){
      const b = document.createElement("span");
      b.className = "badge badge-new";
      b.textContent = "New";
      badges.appendChild(b);
    }
    if (item.isTrending){
      const b = document.createElement("span");
      b.className = "badge badge-trending";
      b.textContent = "Trending";
      badges.appendChild(b);
    }

    meta.appendChild(nameRow);
    meta.appendChild(desc);
    if (previewLine.textContent) meta.appendChild(previewLine);
    meta.appendChild(badges);

    top.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "actions";

    const btnLeft = document.createElement("button");
    btnLeft.className = "btnGhost";

    const btnRight = document.createElement("button");
    btnRight.className = "btn";

    // Smart button behavior
    const locked = isLocked(item);
    const joined = unlocked.has(item.id);
    const joinLink = getJoinLink(item);
    const botLink = getBotLink(item);

    if (locked){
      btnLeft.textContent = "Channel";
      btnLeft.disabled = !joinLink;
      btnRight.textContent = item.lockReason || "Coming soon";
      btnRight.disabled = true;
    } else if (!joined){
      btnLeft.textContent = "Preview";
      btnRight.textContent = "Unlock";
      btnRight.disabled = !joinLink;
    } else {
      btnLeft.textContent = "Channel";
      btnLeft.disabled = !joinLink;
      btnRight.textContent = "Watch now";
      btnRight.disabled = !botLink;
    }

    actions.appendChild(btnLeft);
    actions.appendChild(btnRight);

    card.appendChild(top);
    card.appendChild(actions);

    if (locked){
      const overlay = document.createElement("div");
      overlay.className = "lockOverlay";

      const pill = document.createElement("div");
      // ✅ Add styling hook for coming soon badge
      pill.className = "lockPill" + (item.comingSoon ? " comingSoon" : "");
      pill.textContent = item.lockReason || (item.comingSoon ? "Coming soon" : "Locked");

      overlay.appendChild(pill);
      card.appendChild(overlay);
    }

    // Tap card => modal preview
    card.addEventListener("click", (e) => {
      // don’t trigger when clicking buttons
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "button") return;
      openModal(item);
    });

    // Long press actions
    attachLongPress(card, item);

    // Favorite
    if (favBtn){
      favBtn.onclick = () => {
        haptic("light");
        if (favs.has(item.id)) favs.delete(item.id);
        else favs.add(item.id);
        saveSet(FAV_KEY, favs);
        render(true);
      };
    }

    // Left button action
    btnLeft.onclick = () => {
      haptic("light");
      if (locked){
        if (!joinLink) return popup("No channel", "joinChannel not set.");
        return openTelegram(joinLink);
      }
      if (!joined){
        // Preview
        return openModal(item);
      }
      // Channel
      if (!joinLink) return popup("No channel", "joinChannel not set.");
      openTelegram(joinLink);
    };

    // Right button action
    btnRight.onclick = () => {
      haptic("medium");
      if (locked) return;

      if (!joined){
        if (!joinLink) return popup("No channel set", "This series needs a channel link to unlock.");
        unlocked.add(item.id);
        saveSet(UNLOCK_KEY, unlocked);
        openTelegram(joinLink);
        popup("Unlocked ✅", "After joining, come back and tap Watch now.");
        render(true);
        return;
      }

      if (!botLink) return popup("Missing bot", "botUsername is missing.");
      openTelegram(botLink);
    };

    grid.appendChild(card);
  });

  if (animate && prevRects) animateReorder(prevRects);
}

/* ===== events ===== */
searchInput.addEventListener("input", () => { haptic("light"); render(true); });

showFavsBtn.addEventListener("click", () => {
  showFavsOnly = !showFavsOnly;
  haptic("light");
  render(true);
});

clearFavsBtn.addEventListener("click", () => {
  favs = new Set();
  saveSet(FAV_KEY, favs);
  showFavsOnly = false;
  haptic("success");
  render(true);
});

modalBackdrop.addEventListener("click", () => { haptic("light"); closeModal(); });
modalClose.addEventListener("click", () => { haptic("light"); closeModal(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

init();
