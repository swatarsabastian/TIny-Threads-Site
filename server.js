const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const baseUrl = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error("Missing Supabase env values: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

app.use(express.json());
app.use(express.static(__dirname, { index: false }));

async function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    res.status(401).json({ error: "Missing auth token" });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid auth token" });
    return;
  }

  req.user = data.user;
  next();
}

async function adminOnly(req, res, next) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", req.user.id)
    .single();

  if (error || !data || data.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}

async function markOrderPaid(orderId) {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error("Order not found");
  }

  if (order.status === "paid") {
    return;
  }

  const { data: items, error: itemError } = await supabase
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", orderId);

  if (itemError) {
    throw new Error("Could not fetch order items");
  }

  for (const item of items) {
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, stock")
      .eq("id", item.product_id)
      .single();

    if (productError || !product) {
      throw new Error("Ordered product missing");
    }

    if (product.stock < item.quantity) {
      throw new Error("Stock unavailable for one or more products");
    }

    const { error: stockError } = await supabase
      .from("products")
      .update({ stock: product.stock - item.quantity })
      .eq("id", item.product_id);

    if (stockError) {
      throw new Error("Could not update stock");
    }
  }

  const { error: orderUpdateError } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", orderId);

  if (orderUpdateError) {
    throw new Error("Could not mark order paid");
  }
}

app.get("/api/config", (req, res) => {
  res.json({
    supabaseUrl,
    supabaseAnonKey
  });
});

app.get("/api/products", async (req, res) => {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, image_url, stock")
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (error) {
    res.status(500).json({ error: "Unable to fetch products" });
    return;
  }

  res.json(data || []);
});

app.get("/api/products/:id", async (req, res) => {
  const productId = Number(req.params.id);
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, image_url, stock, is_active")
    .eq("id", productId)
    .single();

  if (error || !data || !data.is_active) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const images = [data.image_url, data.image_url, data.image_url];
  res.json({ ...data, images, colors: ["Pink", "Blue", "Yellow", "Green"] });
});

app.post("/api/orders/checkout", authRequired, async (req, res) => {
  const { items, address, phone, paymentProvider } = req.body;

  if (!Array.isArray(items) || !items.length || !address || !phone || !paymentProvider) {
    res.status(400).json({ error: "Missing checkout details" });
    return;
  }

  const productIds = [...new Set(items.map((item) => Number(item.product_id)).filter(Boolean))];
  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name, price, stock")
    .in("id", productIds);

  if (productError) {
    res.status(500).json({ error: "Could not validate products" });
    return;
  }

  const productMap = new Map((products || []).map((p) => [p.id, p]));
  let totalAmount = 0;
  const orderItems = [];

  for (const item of items) {
    const product = productMap.get(Number(item.product_id));
    const quantity = Number(item.quantity);
    const size = String(item.size || "").trim();

    if (!product || !quantity || quantity < 1 || !size) {
      res.status(400).json({ error: "Invalid cart item" });
      return;
    }

    if (quantity > product.stock) {
      res.status(400).json({ error: `${product.name} is out of stock for requested quantity` });
      return;
    }

    totalAmount += product.price * quantity;
    orderItems.push({ product_id: product.id, quantity, size, unit_price: product.price, name: product.name });
  }

  const { data: createdOrder, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: req.user.id,
      phone: phone.trim(),
      shipping_address: address.trim(),
      total_amount: totalAmount,
      payment_provider: paymentProvider,
      status: "pending"
    })
    .select("id")
    .single();

  if (orderError || !createdOrder) {
    res.status(500).json({ error: "Could not create order" });
    return;
  }

  const orderId = createdOrder.id;
  const orderItemRows = orderItems.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    quantity: item.quantity,
    size: item.size,
    unit_price: item.unit_price
  }));

  const { error: itemInsertError } = await supabase.from("order_items").insert(orderItemRows);
  if (itemInsertError) {
    res.status(500).json({ error: "Could not save order items" });
    return;
  }

  if (paymentProvider === "cod" || paymentProvider === "whatsapp") {
    await markOrderPaid(orderId);
    res.json({
      checkoutType: "success",
      orderId,
      message: paymentProvider === "cod"
        ? "Order placed with Cash on Delivery."
        : "Order placed. Please confirm once on WhatsApp."
    });
    return;
  }

  res.status(400).json({ error: "Unsupported payment provider" });
});

app.get("/api/my-orders", authRequired, async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("id, total_amount, status, payment_provider, created_at")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: "Could not fetch orders" });
    return;
  }
  res.json(data || []);
});

app.get("/api/admin/products", authRequired, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, price, image_url, stock, is_active")
    .order("id", { ascending: true });

  if (error) {
    res.status(500).json({ error: "Could not fetch products" });
    return;
  }

  res.json(data || []);
});

app.post("/api/admin/products", authRequired, adminOnly, async (req, res) => {
  const { name, description, price, image_url, stock, is_active } = req.body;
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: String(name || "").trim(),
      description: String(description || "").trim(),
      price: Number(price),
      image_url: String(image_url || "").trim(),
      stock: Number(stock),
      is_active: Boolean(is_active)
    })
    .select("id")
    .single();

  if (error) {
    res.status(400).json({ error: "Could not create product" });
    return;
  }

  res.status(201).json({ id: data.id });
});

app.put("/api/admin/products/:id", authRequired, adminOnly, async (req, res) => {
  const productId = Number(req.params.id);
  const { name, description, price, image_url, stock, is_active } = req.body;

  const { error } = await supabase
    .from("products")
    .update({
      name: String(name || "").trim(),
      description: String(description || "").trim(),
      price: Number(price),
      image_url: String(image_url || "").trim(),
      stock: Number(stock),
      is_active: Boolean(is_active)
    })
    .eq("id", productId);

  if (error) {
    res.status(400).json({ error: "Could not update product" });
    return;
  }

  res.json({ message: "Product updated" });
});

app.delete("/api/admin/products/:id", authRequired, adminOnly, async (req, res) => {
  const productId = Number(req.params.id);
  const { error } = await supabase.from("products").delete().eq("id", productId);

  if (error) {
    res.status(400).json({ error: "Could not delete product" });
    return;
  }

  res.json({ message: "Product deleted" });
});

app.get("/api/admin/orders", authRequired, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("id, user_id, total_amount, status, payment_provider, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    res.status(500).json({ error: "Could not fetch orders" });
    return;
  }
  res.json(data || []);
});

app.get("/api/admin/low-stock", authRequired, adminOnly, async (req, res) => {
  const threshold = Number(req.query.threshold || 5);
  const { data, error } = await supabase
    .from("products")
    .select("id, name, stock")
    .lte("stock", threshold)
    .order("stock", { ascending: true });
  if (error) {
    res.status(500).json({ error: "Could not fetch low stock items" });
    return;
  }
  res.json(data || []);
});

const pageMap = {
  "/": "login.html",
  "/home": "index.html",
  "/shop": "shop.html",
  "/product": "product.html",
  "/cart": "cart.html",
  "/checkout": "checkout.html",
  "/success": "success.html",
  "/login": "login.html",
  "/about": "about.html",
  "/contact": "contact.html",
  "/orders": "orders.html",
  "/admin": "admin.html"
};

app.get("*", (req, res) => {
  const pageFile = pageMap[req.path];
  if (pageFile) {
    res.sendFile(path.join(__dirname, pageFile));
    return;
  }
  res.status(404).sendFile(path.join(__dirname, "404.html"));
});

app.listen(PORT, () => {
  console.log(`TINYTHREADS server running at ${baseUrl}`);
});
