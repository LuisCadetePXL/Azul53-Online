window.addEventListener("load", () => {
    const form = document.getElementById("signup-form");
    if (form) {
        form.addEventListener("submit", handleSubmit);
    } else {
        console.error("Formulier niet gevonden!");
    }
});

function handleSubmit(e) {
    e.preventDefault();
    clearError();

    const email = document.getElementById("email").value.trim();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const passwordVerify = document.getElementById("passwordVerify").value;
    const visitDate = document.getElementById("visitDate").value;

    // Validatie: verplichte velden
    if (!email || !username || !password || !passwordVerify) {
        return showError("Gelieve alle verplichte velden in te vullen.");
    }

    // Validatie: wachtwoorden komen niet overeen
    if (password !== passwordVerify) {
        return showError("Wachtwoorden komen niet overeen.");
    }

    // Validatie: wachtwoord te kort
    if (password.length < 6) {
        return showError("Wachtwoord moet minstens 6 karakters lang zijn.");
    }

    // Validatie: datum moet in het verleden liggen indien ingevuld
    if (visitDate && new Date(visitDate) > new Date()) {
        return showError("De datum van je laatste verblijf moet in het verleden liggen.");
    }

    registerUser(email, username, password, visitDate);
}

function registerUser(email, username, password, visitDate) {
    const url = "https://localhost:5051/api/Authentication/register";

    const data = {
        email,
        password,
        username: username,
        lastVisitPortugal: visitDate || null
    };

    fetch(url, {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    })
        .then(async response => {
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Onbekende fout" }));
                showError(errorData.message || "Er is iets fout gegaan bij het registreren.");
                throw new Error(errorData.message);
            }

            // Succes: redirect naar login met vooringevuld e-mailadres
            window.location.href = `index.html?email=${encodeURIComponent(email)}`;
        })
        .catch(err => {
            console.error("Register fout:", err);
        });
}

function showError(message) {
    const div = document.getElementById("error-message");
    div.textContent = message;
    div.style.display = "block";

    setTimeout(() => {
        div.style.display = "none";
    }, 5000);
}

function clearError() {
    const div = document.getElementById("error-message");
    div.textContent = "";
    div.style.display = "none";
}
