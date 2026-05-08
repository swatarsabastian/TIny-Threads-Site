const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");
const status = document.getElementById("authStatus");

function setStatus(text, isError = false) {
  status.textContent = text;
  status.style.color = isError ? "#b42318" : "#4a4a59";
}

async function authClient() {
  return TinyThreads.getSupabase();
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const supabase = await authClient();
  const formData = new FormData(signupForm);
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email")),
    password: String(formData.get("password"))
  });
  setStatus(error ? error.message : "Signup successful. You can login now.", Boolean(error));
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const supabase = await authClient();
  const formData = new FormData(loginForm);
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password"))
  });
  if (error) {
    setStatus(error.message, true);
    return;
  }
  window.location.href = "/shop";
});
