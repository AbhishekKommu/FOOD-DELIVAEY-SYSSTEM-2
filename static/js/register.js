// register.js — Handle registration form submission

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const alertBox = document.getElementById("alertBox");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;
    const address = document.getElementById("address").value;
    const password = document.getElementById("password").value;

    alertBox.style.display = "none";

    const data = await API.post("/api/register", { name, email, phone, address, password });

    if (data.error) {
      alertBox.textContent = data.error;
      alertBox.className = "alert alert-error";
      alertBox.style.display = "block";
      return;
    }

    alertBox.textContent = "Account created! Redirecting...";
    alertBox.className = "alert alert-success";
    alertBox.style.display = "block";

    setTimeout(() => { window.location.href = "/menu"; }, 800);
  });
});
