const statusMessage = document.getElementById("statusMessage");
const productGrid = document.getElementById("productGrid");
const cartList = document.getElementById("cartList");
const cartTotal = document.getElementById("cartTotal");
const userStatus = document.getElementById("userStatus");
const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");
const checkoutForm = document.getElementById("checkoutForm");

let supabaseClient;
let currentSession = null;
let products = [];
let cart = [];

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#b42318" : "#4a4a59";
}

function formatPrice(price) {
  return `Rs. ${Number(price).toLocaleString("en-IN")}`;
}

function renderCart() {
  cartList.innerHTML = "";
  if (!cart.length) {
    cartList.innerHTML = "<p class='muted'>Cart is empty.</p>";
    cartTotal.textContent = "Total: Rs. 0";
    return;
  }

  let total = 0;
  cart.forEach((item, index) => {
    total += item.price * item.quantity;
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <strong>${item.name}</strong>
      <span>Size: ${item.size} | Qty: ${item.quantity}</span>
      <span>${formatPrice(item.price * item.quantity)}</span>
      <button class="btn btn-secondary remove-cart-item" data-index="${index}" type="button">Remove</button>
    `;
    cartList.appendChild(row);
  });

  cartTotal.textContent = `Total: ${formatPrice(total)}`;
}

function renderProducts() {
  productGrid.innerHTML = "";
  if (!products.length) {
    productGrid.innerHTML = "<p class='muted'>No products available.</p>";
    return;
  }

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${product.image_url}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="card-footer">
          <span class="price">${formatPrice(product.price)}</span>
          <span>Stock: ${product.stock}</span>
        </div>
        <div class="inline-actions">
          <select class="size-select">
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L">L</option>
            <option value="XL">XL</option>
          </select>
          <input class="qty-input" type="number" value="1" min="1" max="${product.stock}">
          <button class="btn btn-order add-cart-btn" data-product-id="${product.id}" type="button">Add to Cart</button>
        </div>
      </div>
    `;
    productGrid.appendChild(card);
  });
}

async function loadProducts() {
  const response = await fetch("/api/products");
  if (!response.ok) {
    throw new Error("Could not load products");
  }
  products = await response.json();
  renderProducts();
}

async function setupSupabase() {
  const response = await fetch("/api/config");
  const config = await response.json();
  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
}

async function refreshUserState() {
  const { data } = await supabaseClient.auth.getSession();
  currentSession = data.session;
  userStatus.textContent = currentSession ? `Logged in as ${currentSession.user.email}` : "Not logged in";
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(signupForm);
  const { error } = await supabaseClient.auth.signUp({
    email: String(formData.get("email")),
    password: String(formData.get("password"))
  });
  if (error) {
    setStatus(error.message, true);
    return;
  }
  setStatus("Signup successful. Please verify email if required, then login.");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password"))
  });
  if (error) {
    setStatus(error.message, true);
    return;
  }
  await refreshUserState();
  setStatus("Logged in successfully.");
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  await refreshUserState();
  setStatus("Logged out.");
});

productGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".add-cart-btn");
  if (!button) {
    return;
  }

  const card = button.closest(".product-card");
  const productId = Number(button.dataset.productId);
  const product = products.find((item) => item.id === productId);
  if (!product) {
    return;
  }

  const size = card.querySelector(".size-select").value;
  const quantity = Number(card.querySelector(".qty-input").value);
  if (!quantity || quantity < 1 || quantity > product.stock) {
    setStatus("Please enter a valid quantity.", true);
    return;
  }

  cart.push({ product_id: product.id, name: product.name, size, quantity, price: product.price });
  renderCart();
  setStatus(`${product.name} added to cart.`);
});

cartList.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-cart-item");
  if (!button) {
    return;
  }
  cart.splice(Number(button.dataset.index), 1);
  renderCart();
});

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentSession) {
    setStatus("Please login before checkout.", true);
    return;
  }
  if (!cart.length) {
    setStatus("Your cart is empty.", true);
    return;
  }

  const formData = new FormData(checkoutForm);
  const payload = {
    items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity, size: item.size })),
    phone: String(formData.get("phone")).trim(),
    address: String(formData.get("address")).trim(),
    paymentProvider: String(formData.get("paymentProvider"))
  };

  const response = await fetch("/api/orders/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentSession.access_token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || "Checkout failed", true);
    return;
  }

  if (data.checkoutType === "redirect") {
    window.location.href = data.url;
    return;
  }

  if (data.orderId) {
    cart = [];
    renderCart();
    await loadProducts();
    setStatus("Order confirmed.");
  }
});

async function checkPostCheckoutState() {
  return;
}

async function bootstrap() {
  try {
    setStatus("Loading app...");
    await setupSupabase();
    await refreshUserState();
    await loadProducts();
    renderCart();
    await checkPostCheckoutState();
    setStatus("Ready.");
  } catch (error) {
    setStatus(error.message || "Initialization failed", true);
  }
}

bootstrap();
