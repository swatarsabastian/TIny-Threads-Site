const grid = document.getElementById("shopGrid");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const sizeFilter = document.getElementById("sizeFilter");
const priceFilter = document.getElementById("priceFilter");
const sortFilter = document.getElementById("sortFilter");

let allProducts = [];

function mapCategory(name) {
  return name.toLowerCase().includes("kurti") ? "Kurti" : "Salwaar Suites";
}

function renderProducts(items) {
  grid.innerHTML = "";
  if (!items.length) {
    grid.innerHTML = "<p class='muted'>No products found.</p>";
    return;
  }

  items.forEach((product) => {
    const category = mapCategory(product.name);
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${product.image_url}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${category} | Stock: ${product.stock}</p>
        <div class="card-footer">
          <span class="price">${TinyThreads.formatPrice(product.price)}</span>
          <a class="btn btn-order" href="/product?id=${product.id}">Details</a>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const size = sizeFilter.value;
  const priceRange = priceFilter.value;
  const sort = sortFilter.value;

  let items = allProducts.filter((product) => {
    const productCategory = mapCategory(product.name);
    const inCategory = category === "all" || productCategory === category;
    const inSize = size === "all" || ["S", "M", "L", "XL"].includes(size);
    const inQuery = !query || product.name.toLowerCase().includes(query);
    let inPrice = true;
    if (priceRange === "lt1000") inPrice = product.price < 1000;
    if (priceRange === "1000to2000") inPrice = product.price >= 1000 && product.price <= 2000;
    if (priceRange === "gt2000") inPrice = product.price > 2000;
    return inCategory && inSize && inQuery && inPrice;
  });

  if (sort === "low_high") items = items.sort((a, b) => a.price - b.price);
  if (sort === "new") items = items.sort((a, b) => b.id - a.id);
  renderProducts(items);
}

async function bootstrap() {
  const response = await fetch("/api/products");
  allProducts = await response.json();
  applyFilters();
}

[searchInput, categoryFilter, sizeFilter, priceFilter, sortFilter].forEach((el) => {
  el.addEventListener("input", applyFilters);
  el.addEventListener("change", applyFilters);
});

bootstrap();
