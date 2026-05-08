const cartList = document.getElementById("cartList");
const totalEl = document.getElementById("cartTotal");

function renderCart() {
  const cart = TinyThreads.getCart();
  cartList.innerHTML = "";
  if (!cart.length) {
    cartList.innerHTML = "<p class='muted'>Your cart is empty.</p>";
    totalEl.textContent = "Total: Rs. 0";
    return;
  }

  cart.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <strong>${item.name}</strong>
      <span>Size: ${item.size} | Color: ${item.color || "-"}</span>
      <input type="number" min="1" value="${item.quantity}" data-index="${index}" class="qty-update">
      <span>${TinyThreads.formatPrice(item.quantity * item.price)}</span>
      <button data-index="${index}" class="btn btn-secondary remove-item" type="button">Remove</button>
    `;
    cartList.appendChild(row);
  });

  totalEl.textContent = `Total: ${TinyThreads.formatPrice(TinyThreads.cartTotal())}`;
}

cartList.addEventListener("click", (event) => {
  const removeBtn = event.target.closest(".remove-item");
  if (!removeBtn) return;
  TinyThreads.removeFromCart(Number(removeBtn.dataset.index));
  renderCart();
});

cartList.addEventListener("change", (event) => {
  const qty = event.target.closest(".qty-update");
  if (!qty) return;
  const cart = TinyThreads.getCart();
  cart[Number(qty.dataset.index)].quantity = Number(qty.value);
  TinyThreads.setCart(cart);
  renderCart();
});

renderCart();
