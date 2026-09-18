// menu.js — Display menu items with category filters and search, add to cart

let allItems = [];

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("menuGrid");
  const filtersContainer = document.getElementById("categoryFilters");
  const searchInput = document.getElementById("searchInput");
  if (!grid) return;

  try {
    allItems = await API.get("/api/menu");
    renderCategories();
    renderItems(allItems);
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><p>Could not load the menu. Please try again later.</p></div>';
  }

  // Category filter
  filtersContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("filter-btn")) {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      filterItems();
    }
  });

  // Search
  if (searchInput) {
    searchInput.addEventListener("input", filterItems);
  }
});

function renderCategories() {
  const filtersContainer = document.getElementById("categoryFilters");
  const categories = ["All", ...new Set(allItems.map(i => i.category))];
  filtersContainer.innerHTML = categories.map(cat =>
    `<button class="filter-btn ${cat === 'All' ? 'active' : ''}" data-category="${cat}">${cat}</button>`
  ).join("");
}

function filterItems() {
  const activeCat = document.querySelector(".filter-btn.active")?.dataset.category || "All";
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
  let filtered = allItems;
  if (activeCat !== "All") filtered = filtered.filter(i => i.category === activeCat);
  if (search) filtered = filtered.filter(i =>
    i.name.toLowerCase().includes(search) ||
    (i.description || "").toLowerCase().includes(search)
  );
  renderItems(filtered);
}

function renderItems(items) {
  const grid = document.getElementById("menuGrid");
  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🍽️</div><h3>No dishes found</h3><p>Try a different category or search term.</p><a href="/menu" class="btn btn-primary">Reset</a></div>';
    return;
  }
  grid.innerHTML = items.map(item => `
    <div class="dish-card">
      <div class="dish-image-wrap">
        <img src="${item.image_url || 'https://images.pexels.com/photos/3756523/pexels-photo-3756523.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'}" 
             alt="${item.name}" class="dish-image" loading="lazy" />
        <span class="dish-category-tag">${item.category}</span>
        ${!item.is_available ? '<div class="dish-unavailable">Sold Out</div>' : ''}
      </div>
      <div class="dish-body">
        <h3 class="dish-name">${item.name}</h3>
        <p class="dish-desc">${item.description || 'Delicious and freshly prepared.'}</p>
        <div class="dish-footer">
          <span class="dish-price">$${item.price.toFixed(2)}</span>
          <button class="dish-add-btn" ${!item.is_available ? 'disabled' : ''} onclick="addToCart(${item.id})">
            ${item.is_available ? '+ Add to Cart' : 'Unavailable'}
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

async function addToCart(menuItemId) {
  try {
    const data = await API.post("/api/cart", { menu_item_id: menuItemId, quantity: 1 });
    if (data.error) {
      if (data.error.includes("Authentication")) {
        showToast("Please log in to add items to your cart", "error");
        setTimeout(() => { window.location.href = "/login"; }, 1200);
        return;
      }
      showToast(data.error, "error");
      return;
    }
    showToast("Added to cart!", "success");
    updateCartBadge();
  } catch (e) {
    showToast("Could not add item to cart", "error");
  }
}
