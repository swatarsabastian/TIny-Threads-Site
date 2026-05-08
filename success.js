const info = document.getElementById("orderInfo");

const orderId = TinyThreads.queryParam("orderId");
info.textContent = `Order ID: #${orderId || "N/A"}`;
