const checkoutForm = document.getElementById("checkoutForm");
const summary = document.getElementById("orderSummary");
const msg = document.getElementById("checkoutStatus");
let session = null;

function setStatus(text, isError = false) {
  msg.textContent = text;
  msg.style.color = isError ? "#b42318" : "#4a4a59";
}

function renderSummary() {
  const items = TinyThreads.getCart();
  summary.innerHTML = "";
  items.forEach((item) => {
    const p = document.createElement("p");
    p.textContent = `${item.name} x ${item.quantity} (${item.size}) - ${TinyThreads.formatPrice(item.quantity * item.price)}`;
    summary.appendChild(p);
  });
  const total = document.createElement("p");
  total.className = "price";
  total.textContent = `Total: ${TinyThreads.formatPrice(TinyThreads.cartTotal())}`;
  summary.appendChild(total);
}

async function initAuth() {
  const supabase = await TinyThreads.getSupabase();
  const { data } = await supabase.auth.getSession();
  session = data.session;
  if (!session) {
    setStatus("Please login before checkout.", true);
  }
}

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!session) {
    setStatus("Please login first.", true);
    return;
  }
  const formData = new FormData(checkoutForm);
  const payload = {
    items: TinyThreads.getCart().map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      size: item.size
    })),
    phone: String(formData.get("phone")).trim(),
    address: String(formData.get("address")).trim(),
    paymentProvider: String(formData.get("paymentProvider"))
  };

  const response = await fetch("/api/orders/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`
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

  TinyThreads.setCart([]);
  window.location.href = `/success?orderId=${data.orderId}`;
});

renderSummary();
initAuth();
