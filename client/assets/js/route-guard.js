/* SARTHI Session & Route Guard
 * Enforces the startup sequence:
 * 1. Fresh open of any page (dashboard, login, etc.) -> starts with intro animation
 * 2. Intro animation plays -> continues to login
 * 3. Login validates auth -> points directly to dashboard
 * 4. Once in active session -> all sidebar navigation works seamlessly between pages without re-triggering intro
 */
(() => {
  const path = window.location.pathname.toLowerCase();
  const page = path.split("/").pop().replace(/\.html$/, "");

  // intro.html is the animation showcase; always allow it to render
  if (page === "intro") return;

  const introUrl = path.includes("/pages/") ? "intro.html" : "pages/intro.html";

  // Opening login directly before seeing intro -> start with intro first
  if (page === "login") {
    if (!sessionStorage.getItem("sarthi_intro_done")) {
      window.location.replace(introUrl);
    }
    return;
  }

  // Opening dashboard or any app page directly on initial launch -> start with intro
  if (!sessionStorage.getItem("sarthi_session_active")) {
    window.location.replace(introUrl);
    return;
  }

  // Not logged in -> start with intro then login
  if (!localStorage.getItem("sarthi_token")) {
    window.location.replace(introUrl);
    return;
  }
})();
