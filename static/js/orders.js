// orders.js — Display user's order history

document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("ordersList");
  if (!list) return;

  try {
    const orders = await API.get("/api/orders");
    if (orders.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <h3>No orders yet</h3>
          <p>When you place an order, it will appear here.</p>
          <a href="/menu" class="btn btn-primary">Order Now</a>
        </div>`;
      return;
    }

    list.innerHTML = orders.map(order => {
      const statusClass = {
        "Pending": "status-pending",
        "Preparing": "status-preparing",
        "Out for Delivery": "status-out",
        "Delivered": "status-delivered",
        "Cancelled": "status-cancelled"
      }[order.status] || "status-pending";

      const itemsHtml = (order.items || []).map(item =>
        `<div class="order-item-row">
          <span>${item.name} × ${item.quantity}</span>
          <span>$${(item.price * item.quantity).toFixed(2)}</span>
        </div>`
      ).join("");

      const date = new Date(order.created_at).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      });

      return `
        <div class="order-card">
          <div class="order-header">
            <div>
              <div class="order-id">Order #${order.id}</div>
              <div class="order-date">${date}</div>
            </div>
            <span class="order-status ${statusClass}">${order.status}</span>
          </div>
          <div class="order-items-list">${itemsHtml}</div>
          <div class="order-total">
            <span>Total</span>
            <span>$${order.total.toFixed(2)}</span>
          </div>
          ${order.delivery_address ? `<p style="margin-top:12px;font-size:0.85rem;color:var(--text-muted)">📍 ${order.delivery_address}</p>` : ""}
          ${order.phone ? `<p style="font-size:0.85rem;color:var(--text-muted)">📞 ${order.phone}</p>` : ""}
        </div>`;
    }).join("");
  } catch (e) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔐</div>
        <h3>Please log in</h3>
        <p>You need to be logged in to view your orders.</p>
        <a href="/login" class="btn btn-primary">Log In</a>
      </div>`;
  }
});
