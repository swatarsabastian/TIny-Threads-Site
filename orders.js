const ordersWrap = document.getElementById("ordersWrap");

async function loadOrders() {
  const supabase = await TinyThreads.getSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    ordersWrap.innerHTML = "<p class='muted'>Please login to view order history.</p>";
    return;
  }

  const response = await fetch("/api/my-orders", {
    headers: { Authorization: `Bearer ${data.session.access_token}` }
  });
  const orders = await response.json();
  if (!response.ok) {
    ordersWrap.innerHTML = "<p class='muted'>Unable to fetch orders.</p>";
    return;
  }

  ordersWrap.innerHTML = "";
  if (!orders.length) {
    ordersWrap.innerHTML = "<p class='muted'>No orders yet.</p>";
    return;
  }
  orders.forEach((order) => {
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <strong>#${order.id}</strong>
      <span>${new Date(order.created_at).toLocaleString()}</span>
      <span>${TinyThreads.formatPrice(order.total_amount)}</span>
      <span>Status: ${order.status}</span>
    `;
    ordersWrap.appendChild(row);
  });
}

loadOrders();
