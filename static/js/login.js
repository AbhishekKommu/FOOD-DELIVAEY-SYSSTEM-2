// login.js — Handle login form submission

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const alertBox = document.getElementById("alertBox");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    alertBox.style.display = "none";

    const data = await API.post("/api/login", { email, password });

    if (data.error) {
      alertBox.textContent = data.error;
      alertBox.className = "alert alert-error";
      alertBox.style.display = "block";
      return;
    }

    alertBox.textContent = "Login successful! Redirecting...";
    alertBox.className = "alert alert-success";
    alertBox.style.display = "block";

    setTimeout(() => {
      if (data.user.is_admin) {
        window.location.href = "/admin";
      } else {
        window.location.href = "/menu";
      }
    }, 800);
  });
});
