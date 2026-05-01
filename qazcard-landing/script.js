/**
 * SEO-лендинг QazCard AI — единое место для ссылок на основной сервис.
 *
 * APP_ORIGIN:
 *   '' — относительные пути (лендинг на том же домене, что и приложение).
 *   'https://app.qazcard.ai' — если лендинг на отдельном домене (см. README).
 */
const APP_ORIGIN = "";

const LINKS = {
  login: `${APP_ORIGIN}/login`,
  register: `${APP_ORIGIN}/register`,
  registerProductCard: `${APP_ORIGIN}/register?next=/dashboard/create/product-card`,
  registerVideo: `${APP_ORIGIN}/register?next=/dashboard/create/video`,
  registerImage: `${APP_ORIGIN}/register?next=/dashboard/create/image`,
  terms: `${APP_ORIGIN}/terms`,
  privacy: `${APP_ORIGIN}/privacy`,
  refundPolicy: `${APP_ORIGIN}/refund-policy`,
  aiContentPolicy: `${APP_ORIGIN}/ai-content-policy`,
};

function applyLinks() {
  document.querySelectorAll("[data-link]").forEach((el) => {
    const key = el.getAttribute("data-link");
    if (key && LINKS[key]) {
      el.setAttribute("href", LINKS[key]);
    }
  });
}

function initNav() {
  const btn = document.querySelector(".nav-toggle");
  const panel = document.querySelector(".nav-panel");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => {
    const open = panel.classList.toggle("nav-panel--open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  panel.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      panel.classList.remove("nav-panel--open");
      btn.setAttribute("aria-expanded", "false");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyLinks();
  initNav();
});
