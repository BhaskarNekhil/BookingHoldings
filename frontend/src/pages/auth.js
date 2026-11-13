function renderAuth() {
  $("#content").innerHTML =
    `<div class="panel auth"><span class="eyebrow">LET’S GET YOU GOING</span><h2>${signup ? "Meet your travel people." : "Welcome back, explorer."}</h2><p class="sub">${signup ? "A few details to find travellers who share your interests." : "Log in to plan your next shared adventure."}</p><div class="tabs"><button id="login-tab" class="${!signup ? "active" : ""}">Log in</button><button id="signup-tab" class="${signup ? "active" : ""}">Sign up</button></div><form id="auth-form"><div class="form-grid">${signup ? field("Your name", "name") : ""}${field("Email address", "email", "email")}${field("Password", "password", "password", 'minlength="8" autocomplete="' + (signup ? "new-password" : "current-password") + '"')}${signup ? `${field("Age", "age", "number", 'min="18" max="120"')}${field("Home city", "homeCity")}<div><label for="gender">Gender</label><select name="gender" id="gender"><option value="FEMALE">Female</option><option value="MALE">Male</option></select></div><div class="wide"><label>Your interests</label>${chips()}</div>` : ""}</div><div class="actions"><button type="submit">${signup ? "Create account" : "Log in"} ↗</button></div></form></div>`;
  $("#login-tab").onclick = () => {
    signup = false;
    renderAuth();
  };
  $("#signup-tab").onclick = () => {
    signup = true;
    renderAuth();
  };
  $("#auth-form").onsubmit = async (e) => {
    e.preventDefault();
    await busy(e.submitter, async () => {
      const f = new FormData(e.target);
      session = await api("/auth/" + (signup ? "signup" : "login"), "POST", {
        ...Object.fromEntries(f),
        age: f.get("age") ? Number(f.get("age")) : undefined,
        interests: f.getAll("interests"),
      });
      sessionStorage.setItem("roam-session", JSON.stringify(session));
      await render();
    });
  };
}
