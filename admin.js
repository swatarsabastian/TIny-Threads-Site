const adminLoginForm = document.getElementById("adminLoginForm");
const productForm = document.getElementById("productForm");
const adminProductList = document.getElementById("adminProductList");
const lowStockList = document.getElementById("lowStockList");
const adminOrderList = document.getElementById("adminOrderList");
const adminStatus = document.getElementById("adminStatus");
const adminStatusText = document.getElementById("adminStatusText");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

let supabaseClient;
let adminSession = null;

function setAdminStatus(message, isError = false) {
  adminStatus.textContent = message;
  adminStatus.style.color = isError ? "#b42318" : "#4a4a59";
}

async function setupSupabase() {
  const response = await fetch("/api/config");
  const config = await response.json();
  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
}

async function refreshAdminState() {
  const { data } = await supabaseClient.auth.getSession();
  adminSession = data.session;
  adminStatusText.textContent = adminSession ? `Logged in as ${adminSession.user.email}` : "Not logged in";
}

async function loadAdminProducts() {
  if (!adminSession) {
    adminProductList.innerHTML = "<p class='muted'>Login first.</p>";
    return;
  }

  const response = await fetch("/api/admin/products", {
    headers: { Authorization: `Bearer ${adminSession.access_token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    adminProductList.innerHTML = "<p class='muted'>No access or failed to load products.</p>";
    return;
  }

  adminProductList.innerHTML = "";
  data.forEach((product) => {
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <strong>${product.name}</strong>
      <span>Stock: ${product.stock} | Price: Rs. ${Number(product.price).toLocaleString("en-IN")}</span>
      <span>${product.is_active ? "Active" : "Inactive"}</span>
      <div class="inline-actions">
        <button class="btn btn-secondary edit-product" data-id="${product.id}" type="button">Edit</button>
        <button class="btn btn-secondary delete-product" data-id="${product.id}" type="button">Delete</button>
      </div>
    `;
    row.dataset.product = JSON.stringify(product);
    adminProductList.appendChild(row);
  });
}

async function loadLowStock() {
  if (!adminSession) {
    lowStockList.innerHTML = "<p class='muted'>Login first.</p>";
    return;
  }
  const response = await fetch("/api/admin/low-stock", {
    headers: { Authorization: `Bearer ${adminSession.access_token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    lowStockList.innerHTML = "<p class='muted'>Unable to load low stock.</p>";
    return;
  }
  lowStockList.innerHTML = data.length
    ? data.map((item) => `<p>${item.name} - Stock: ${item.stock}</p>`).join("")
    : "<p class='muted'>No low stock products.</p>";
}

async function loadAdminOrders() {
  if (!adminSession) {
    adminOrderList.innerHTML = "<p class='muted'>Login first.</p>";
    return;
  }
  const response = await fetch("/api/admin/orders", {
    headers: { Authorization: `Bearer ${adminSession.access_token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    adminOrderList.innerHTML = "<p class='muted'>Unable to load orders.</p>";
    return;
  }
  adminOrderList.innerHTML = "";
  data.forEach((order) => {
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <strong>#${order.id}</strong>
      <span>${new Date(order.created_at).toLocaleString()}</span>
      <span>Rs. ${Number(order.total_amount).toLocaleString("en-IN")}</span>
      <span>${order.status}</span>
    `;
    adminOrderList.appendChild(row);
  });
}

adminLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(adminLoginForm);
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password"))
  });
  if (error) {
    setAdminStatus(error.message, true);
    return;
  }
  await refreshAdminState();
  await loadAdminProducts();
  await loadLowStock();
  await loadAdminOrders();
  setAdminStatus("Logged in. If your role is admin, inventory actions are enabled.");
});

adminLogoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  await refreshAdminState();
  await loadAdminProducts();
  await loadLowStock();
  await loadAdminOrders();
  setAdminStatus("Logged out.");
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!adminSession) {
    setAdminStatus("Please login as admin.", true);
    return;
  }
  const formData = new FormData(productForm);
  const payload = {
    name: String(formData.get("name")).trim(),
    description: String(formData.get("description")).trim(),
    price: Number(formData.get("price")),
    image_url: String(formData.get("image_url")).trim(),
    stock: Number(formData.get("stock")),
    is_active: formData.get("is_active") === "on"
  };

  const response = await fetch("/api/admin/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminSession.access_token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    setAdminStatus(data.error || "Failed to create product", true);
    return;
  }

  productForm.reset();
  setAdminStatus("Product added.");
  await loadAdminProducts();
  await loadLowStock();
});

adminProductList.addEventListener("click", async (event) => {
  const editBtn = event.target.closest(".edit-product");
  const deleteBtn = event.target.closest(".delete-product");
  if (!editBtn && !deleteBtn) {
    return;
  }
  if (!adminSession) {
    setAdminStatus("Please login as admin.", true);
    return;
  }

  if (deleteBtn) {
    const response = await fetch(`/api/admin/products/${deleteBtn.dataset.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminSession.access_token}` }
    });
    const data = await response.json();
    if (!response.ok) {
      setAdminStatus(data.error || "Failed to delete product", true);
      return;
    }
    setAdminStatus("Product deleted.");
    await loadAdminProducts();
    await loadLowStock();
    return;
  }

  const row = editBtn.closest(".cart-row");
  const current = JSON.parse(row.dataset.product);

  const nextName = prompt("Product name", current.name);
  if (nextName === null) {
    return;
  }
  const nextPrice = prompt("Price", current.price);
  if (nextPrice === null) {
    return;
  }
  const nextStock = prompt("Stock", current.stock);
  if (nextStock === null) {
    return;
  }
  const nextDescription = prompt("Description", current.description);
  if (nextDescription === null) {
    return;
  }
  const nextImageUrl = prompt("Image URL", current.image_url);
  if (nextImageUrl === null) {
    return;
  }

  const response = await fetch(`/api/admin/products/${editBtn.dataset.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminSession.access_token}`
    },
    body: JSON.stringify({
      name: nextName.trim(),
      description: nextDescription.trim(),
      price: Number(nextPrice),
      image_url: nextImageUrl.trim(),
      stock: Number(nextStock),
      is_active: current.is_active
    })
  });
  const data = await response.json();
  if (!response.ok) {
    setAdminStatus(data.error || "Failed to update product", true);
    return;
  }
  setAdminStatus("Product updated.");
  await loadAdminProducts();
  await loadLowStock();
});

async function bootstrap() {
  await setupSupabase();
  await refreshAdminState();
  await loadAdminProducts();
  await loadLowStock();
  await loadAdminOrders();
}

bootstrap().catch((error) => setAdminStatus(error.message, true));
