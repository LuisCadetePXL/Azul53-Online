window.addEventListener("load", () => {
    const form = document.getElementById("login-form");
    if (!form) {
        console.error("Loginformulier niet gevonden!");
        return;
    }

    form.addEventListener("submit", handleLogin);

    // Prefill e-mailadres indien aanwezig in URL
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get("email");
    if (email) {
        document.getElementById("email").value = decodeURIComponent(email);
    }
});

function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    clearMessages();

    let valid = true;

    if (!email || !validateEmail(email)) {
        showMessage("Vul een geldig e-mailadres in.");
        valid = false;
    }

    if (!password) {
        showMessage("Wachtwoord mag niet leeg zijn.");
        valid = false;
    }

    if (!valid) return;

    loginUser(email, password);
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function loginUser(email, password) {
    const apiUrl = "https://localhost:5051/api/Authentication/token";

    fetch(apiUrl, {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    })
        .then(async (response) => {
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                const message = data?.message || "Wachtwoord of e-mail is incorrect.";
                showMessage(message);
                throw new Error(message);
            }

            return response.json();
        })
        .then((data) => {
            sessionStorage.setItem("token", data.token);
            window.location.href = "lobby.html";
        })
        .catch(error => {
            console.error("Login fout:", error);
        });
}

function showMessage(message) {
    const msg = document.getElementById("error-message");
    msg.textContent = message;
    msg.style.display = "block";
    msg.style.opacity = 1;

    setTimeout(() => {
        msg.style.opacity = 0;
    }, 5000);
}

function clearMessages() {
    const msg = document.getElementById("error-message");
    msg.textContent = "";
    msg.style.display = "none";
}
