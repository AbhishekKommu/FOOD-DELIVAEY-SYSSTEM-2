// landing.js — Load featured dishes on the landing page

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("featuredDishes");
  if (!grid) return;

  try {
    const items = await API.get("/api/menu");
    const featured = items.slice(0, 6);

    if (featured.length === 0) {
      grid.innerHTML = '<div class="empty-state"><p>No dishes available yet. Check back soon!</p></div>';
      return;
    }

    grid.innerHTML = featured.map(item => `
      <div class="dish-card">
        <div class="dish-image-wrap">
          <img src="${item.image_url || 'https://images.pexels.com/photos/3756523/pexels-photo-3756523.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'}" 
               alt="${item.name}" class="dish-image" loading="lazy" />
          <span class="dish-category-tag">${item.category}</span>
        </div>
        <div class="dish-body">
          <h3 class="dish-name">${item.name}</h3>
          <p class="dish-desc">${item.description || 'Delicious and freshly prepared.'}</p>
          <div class="dish-footer">
            <span class="dish-price">$${item.price.toFixed(2)}</span>
            <a href="/menu" class="dish-add-btn">Order Now →</a>
          </div>
        </div>
      </div>
    `).join("");
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><p>Could not load dishes. Please try again later.</p></div>';
  }
});
