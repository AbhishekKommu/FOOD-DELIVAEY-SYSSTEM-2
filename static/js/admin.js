// admin.js — Admin dashboard: menu CRUD, order status management, stats

document.addEventListener("DOMContentLoaded", async () => {
  // Check admin access
  try {
    const meData = await API.get("/api/me");
    if (!meData.user || !meData.user.is_admin) {
      window.location.href = "/login";
      return;
    }
  } catch (e) {
    window.location.href = "/login";
    return;
  }

  loadStats();
  loadAdminMenu();
  loadAdminOrders();

  // Tab switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab" + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.add("active");
    });
  });

  // Modal
  const addItemBtn = document.getElementById("addItemBtn");
  const modal = document.getElementById("itemModal");
  const modalClose = document.getElementById("modalClose");

  if (addItemBtn) {
    addItemBtn.addEventListener("click", () => openModal());
  }
  if (modalClose) {
    modalClose.addEventListener("click", () => closeModal());
  }
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Form submit
  const itemForm = document.getElementById("itemForm");
  if (itemForm) {
    itemForm.addEventListener("submit", saveItem);
  }
});

// Stats
async function loadStats() {
  try {
    const stats = await API.get("/api/admin/stats");
    document.getElementById("menuCount").textContent = stats.menu_count;
    document.getElementById("userCount").textContent = stats.user_count;
    document.getElementById("orderCount").textContent = stats.order_count;
    document.getElementById("revenue").textContent = "$" + stats.revenue.toLocaleString();
  } catch (e) {
    console.error("Stats error:", e);
  }
}

// Menu management
async function loadAdminMenu() {
  const tbody = document.getElementById("adminMenuBody");
  if (!tbody) return;

  try {
    const items = await API.get("/api/menu");
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No menu items yet. Click "Add New Item" to create one.</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(item => `
      <tr>
        <td><img src="${item.image_url || 'https://images.pexels.com/photos/3756523/pexels-photo-3756523.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'}" alt="${item.name}" /></td>
        <td><strong>${item.name}</strong><br><span style="font-size:0.8rem;color:var(--text-muted)">${(item.description || '').substring(0, 50)}${item.description && item.description.length > 50 ? '...' : ''}</span></td>
        <td>${item.category}</td>
        <td>$${item.price.toFixed(2)}</td>
        <td>${item.is_available ? '<span style="color:var(--success);font-weight:600">Yes</span>' : '<span style="color:var(--error);font-weight:600">No</span>'}</td>
        <td class="admin-actions">
          <button class="action-btn action-edit" onclick="editItem(${item.id})">Edit</button>
          <button class="action-btn action-delete" onclick="deleteItem(${item.id})">Delete</button>
        </td>
      </tr>
    `).join("");
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--error)">Error loading menu items.</td></tr>';
  }
}

function openModal(item) {
  document.getElementById("modalTitle").textContent = item ? "Edit Menu Item" : "Add Menu Item";
  document.getElementById("itemId").value = item ? item.id : "";
  document.getElementById("itemName").value = item ? item.name : "";
  document.getElementById("itemDescription").value = item ? item.description : "";
  document.getElementById("itemPrice").value = item ? item.price : "";
  document.getElementById("itemCategory").value = item ? item.category : "";
  document.getElementById("itemImage").value = item ? item.image_url : "";
  document.getElementById("itemAvailable").checked = item ? item.is_available : true;
  document.getElementById("modalAlert").style.display = "none";
  document.getElementById("itemModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("itemModal").style.display = "none";
}

async function editItem(id) {
  try {
    const items = await API.get("/api/menu");
    const item = items.find(i => i.id === id);
    if (item) openModal(item);
  } catch (e) {
    showToast("Could not load item", "error");
  }
}

async function saveItem(e) {
  e.preventDefault();
  const id = document.getElementById("itemId").value;
  const data = {
    name: document.getElementById("itemName").value,
    description: document.getElementById("itemDescription").value,
    price: parseFloat(document.getElementById("itemPrice").value),
    category: document.getElementById("itemCategory").value,
    image_url: document.getElementById("itemImage").value,
    is_available: document.getElementById("itemAvailable").checked ? 1 : 0
  };

  const alertBox = document.getElementById("modalAlert");
  alertBox.style.display = "none";

  const result = id
    ? await API.put("/api/menu/" + id, data)
    : await API.post("/api/menu", data);

  if (result.error) {
    alertBox.textContent = result.error;
    alertBox.className = "alert alert-error";
    alertBox.style.display = "block";
    return;
  }

  showToast(id ? "Item updated!" : "Item created!", "success");
  closeModal();
  loadAdminMenu();
  loadStats();
}

async function deleteItem(id) {
  if (!confirm("Are you sure you want to delete this menu item?")) return;
  const result = await API.del("/api/menu/" + id);
  if (result.error) {
    showToast(result.error, "error");
    return;
  }
  showToast("Item deleted", "success");
  loadAdminMenu();
  loadStats();
}

// Order management
async function loadAdminOrders() {
  const tbody = document.getElementById("adminOrdersBody");
  if (!tbody) return;

  try {
    const orders = await API.get("/api/orders");
    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">No orders yet.</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(order => {
      const itemsSummary = (order.items || []).map(i => `${i.name} ×${i.quantity}`).join(", ");
      const date = new Date(order.created_at).toLocaleDateString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      });
      return `
        <tr>
          <td><strong>#${order.id}</strong></td>
          <td>${order.delivery_address || "—"}</td>
          <td style="max-width:250px;font-size:0.82rem">${itemsSummary}</td>
          <td><strong>$${order.total.toFixed(2)}</strong></td>
          <td>
            <select class="status-select" onchange="updateOrderStatus(${order.id}, this.value)">
              <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
              <option value="Preparing" ${order.status === "Preparing" ? "selected" : ""}>Preparing</option>
              <option value="Out for Delivery" ${order.status === "Out for Delivery" ? "selected" : ""}>Out for Delivery</option>
              <option value="Delivered" ${order.status === "Delivered" ? "selected" : ""}>Delivered</option>
              <option value="Cancelled" ${order.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
            </select>
          </td>
          <td style="font-size:0.82rem">${date}</td>
          <td style="font-size:0.82rem;color:var(--text-muted)">${order.phone || "—"}</td>
        </tr>`;
    }).join("");
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--error)">Error loading orders.</td></tr>';
  }
}

async function updateOrderStatus(orderId, status) {
  const result = await API.put("/api/orders/" + orderId + "/status", { status });
  if (result.error) {
    showToast(result.error, "error");
    return;
  }
  showToast("Order status updated", "success");
  loadStats();
}
