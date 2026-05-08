const wrap = document.getElementById("productDetail");
const productId = Number(TinyThreads.queryParam("id"));

async function loadProduct() {
  if (!productId) {
    wrap.innerHTML = "<p class='muted'>Invalid product.</p>";
    return;
  }
  const response = await fetch(`/api/products/${productId}`);
  if (!response.ok) {
    wrap.innerHTML = "<p class='muted'>Product not found.</p>";
    return;
  }
  const product = await response.json();
  const imageStrip = product.images.map((img) => `<img class="thumb" src="${img}" alt="${product.name}">`).join("");
  const colorOptions = product.colors.map((color) => `<option value="${color}">${color}</option>`).join("");
  wrap.innerHTML = `
    <div class="detail-grid">
      <div>
        <img class="hero-image" src="${product.image_url}" alt="${product.name}">
        <div class="thumb-row">${imageStrip}</div>
      </div>
      <div class="card">
        <h2>${product.name}</h2>
        <p class="price">${TinyThreads.formatPrice(product.price)}</p>
        <p>${product.description}</p>
        <div class="stack">
          <label>Size
            <select id="size"><option>S</option><option>M</option><option>L</option><option>XL</option></select>
          </label>
          <label>Color
            <select id="color">${colorOptions}</select>
          </label>
          <label>Quantity
            <input id="qty" type="number" min="1" max="${product.stock}" value="1">
          </label>
          <button id="addToCartBtn" class="btn btn-order" type="button">Add to Cart</button>
          <a class="btn btn-secondary" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=I want to order ${encodeURIComponent(product.name)}">Order via WhatsApp</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById("addToCartBtn").addEventListener("click", () => {
    TinyThreads.addToCart({
      product_id: product.id,
      name: product.name,
      price: product.price,
      quantity: Number(document.getElementById("qty").value),
      size: document.getElementById("size").value,
      color: document.getElementById("color").value
    });
    window.location.href = "/cart";
  });
}

loadProduct();
