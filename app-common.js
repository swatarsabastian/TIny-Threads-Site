window.TinyThreads = (() => {
  const CART_KEY = "tinythreads_cart";
  let configCache = null;
  let supabaseClient = null;

  async function getConfig() {
    if (configCache) return configCache;
    const response = await fetch("/api/config");
    configCache = await response.json();
    return configCache;
  }

  async function getSupabase() {
    if (supabaseClient) return supabaseClient;
    const config = await getConfig();
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    return supabaseClient;
  }

  function formatPrice(price) {
    return `Rs. ${Number(price).toLocaleString("en-IN")}`;
  }

  function getCart() {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  }

  function setCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  function addToCart(item) {
    const cart = getCart();
    cart.push(item);
    setCart(cart);
  }

  function removeFromCart(index) {
    const cart = getCart();
    cart.splice(index, 1);
    setCart(cart);
  }

  function cartTotal() {
    return getCart().reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  function queryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  return {
    getSupabase,
    getConfig,
    formatPrice,
    getCart,
    setCart,
    addToCart,
    removeFromCart,
    cartTotal,
    queryParam
  };
})();
