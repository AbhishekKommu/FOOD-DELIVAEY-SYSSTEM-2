// cart.js — Display cart items, update quantities, checkout

document.addEventListener("DOMContentLoaded", async () => {
  await loadCart();
  const checkoutBtn = document.getElementById("checkoutBtn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", placeOrder);
  }
});

async function loadCart() {
  const container = document.getElementById("cartItems");
  const summary = document.getElementById("cartSummary");
  if (!container) return;

  try {
    const cart = await API.get("/api/cart");
    if (cart.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Browse our menu and add some delicious dishes!</p>
          <a href="/menu" class="btn btn-primary">Browse Menu</a>
        </div>`;
      if (summary) summary.style.display = "none";
      return;
    }

    container.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.image_url || 'https://images.pexels.com/photos/3756523/pexels-photo-3756523.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'}" 
             alt="${item.name}" />
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">$${item.price.toFixed(2)} each</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="updateQty(${item.cart_id}, ${item.quantity - 1})">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn" onclick="updateQty(${item.cart_id}, ${item.quantity + 1})">+</button>
        </div>
        <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
        <button class="cart-item-remove" onclick="removeItem(${item.cart_id})">✕</button>
      </div>
    `).join("");

    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + 2.99;
    document.getElementById("subtotal").textContent = "$" + subtotal.toFixed(2);
    document.getElementById("total").textContent = "$" + total.toFixed(2);
    summary.style.display = "block";
  } catch (e) {
    if (e) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔐</div>
          <h3>Please log in</h3>
          <p>You need to be logged in to view your cart.</p>
          <a href="/login" class="btn btn-primary">Log In</a>
        </div>`;
      if (summary) summary.style.display = "none";
    }
  }
}

async function updateQty(cartId, quantity) {
  if (quantity < 1) {
    removeItem(cartId);
    return;
  }
  await API.put("/api/cart/" + cartId, { quantity });
  loadCart();
  updateCartBadge();
}

async function removeItem(cartId) {
  await API.del("/api/cart/" + cartId);
  showToast("Item removed", "success");
  loadCart();
  updateCartBadge();
}

async function placeOrder() {
  const address = document.getElementById("deliveryAddress").value;
  const phone = document.getElementById("phoneInput").value;

  if (!address || !phone) {
    showToast("Please enter delivery address and phone number", "error");
    return;
  }

  const data = await API.post("/api/orders", { delivery_address: address, phone });
  if (data.error) {
    showToast(data.error, "error");
    return;
  }
  showToast("Order placed successfully!", "success");
  updateCartBadge();
  setTimeout(() => { window.location.href = "/orders"; }, 1200);
}
