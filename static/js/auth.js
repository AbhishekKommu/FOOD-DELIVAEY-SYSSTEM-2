// auth.js — Shared authentication state, navbar updates, and API helper

const API = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, body) => fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => r.json()),
  put: (url, body) => fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => r.json()),
  del: (url) => fetch(url, { method: "DELETE" }).then(r => r.json()),
};

async function updateNavAuthState() {
  try {
    const data = await API.get("/api/me");
    const user = data.user;
    const loginLink = document.getElementById("loginLink");
    const registerLink = document.getElementById("registerLink");
    const logoutBtn = document.getElementById("logoutBtn");
    const navUser = document.getElementById("navUser");
    const adminLink = document.getElementById("adminLink");

    if (user) {
      if (loginLink) loginLink.style.display = "none";
      if (registerLink) registerLink.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";
      if (navUser) {
        navUser.style.display = "inline-block";
        navUser.textContent = "Hi, " + user.name.split(" ")[0];
      }
      if (adminLink && user.is_admin) adminLink.style.display = "inline-block";
    } else {
      if (loginLink) loginLink.style.display = "inline-block";
      if (registerLink) registerLink.style.display = "inline-block";
      if (logoutBtn) logoutBtn.style.display = "none";
      if (navUser) navUser.style.display = "none";
      if (adminLink) adminLink.style.display = "none";
    }
  } catch (e) {
    console.error("Auth state error:", e);
  }
}

async function updateCartBadge() {
  try {
    const data = await API.get("/api/me");
    if (!data.user) return;
    const cart = await API.get("/api/cart");
    const badge = document.getElementById("cartBadge");
    if (badge) {
      const count = cart.reduce((s, i) => s + i.quantity, 0);
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }
  } catch (e) {
    // Not logged in — no badge
  }
}

function showToast(message, type) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = "toast show" + (type ? " toast-" + type : "");
  setTimeout(() => { toast.className = "toast"; }, 3000);
}

document.addEventListener("DOMContentLoaded", () => {
  updateNavAuthState();
  updateCartBadge();

  // Navbar scroll effect
  const navbar = document.getElementById("navbar");
  if (navbar) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 20) navbar.classList.add("scrolled");
      else navbar.classList.remove("scrolled");
    });
  }

  // Mobile nav toggle
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
  }

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await API.post("/api/logout");
      window.location.href = "/";
    });
  }
});
