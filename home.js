const featuredGrid = document.getElementById("featuredGrid");

async function loadFeatured() {
  const response = await fetch("/api/products");
  const products = await response.json();
  featuredGrid.innerHTML = "";
  products.slice(0, 4).forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${product.image_url}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="card-footer">
          <span class="price">${TinyThreads.formatPrice(product.price)}</span>
          <a class="btn btn-order" href="/product?id=${product.id}">View</a>
        </div>
      </div>
    `;
    featuredGrid.appendChild(card);
  });
}

loadFeatured();
