document.addEventListener("DOMContentLoaded", function () {
    // Verkrijg het aantal spelers uit localStorage of gebruik de standaard waarde
    let playerCount = parseInt(localStorage.getItem('playerCount')) || 0;
    const requiredPlayers = parseInt(localStorage.getItem('requiredPlayers')) || 4; // Aantal spelers dat nodig is om het spel te starten

    // Verkrijg de "Leave" knop
    const leaveButton = document.querySelector('#leave');

    // Controleer of de knop bestaat en voeg een event listener toe
    if (leaveButton) {
        leaveButton.addEventListener('click', function () {
            // Verminder het aantal spelers in de localStorage wanneer iemand het spel verlaat
            playerCount--;

            // Update het aantal spelers in localStorage
            localStorage.setItem('playerCount', playerCount);

            // Redirect naar de lobby pagina
            window.location.href = "lobby.html";
        });
    } else {
        console.error("De 'Leave' knop is niet gevonden.");
    }

    // Functie om te controleren of het spel kan beginnen
    const checkStartCondition = () => {
        const boards = document.querySelectorAll('.board');

        // Check of het aantal spelers gelijk is aan het vereiste aantal om te starten
        if (boards.length === requiredPlayers) {
            startGame();
        } else {
            console.log(`Wachten op meer spelers... Heden aantal spelers: ${boards.length}`);
        }
    };

    // Start het spel
    const startGame = () => {
        console.log("Het spel begint!");

        // Verander de titelbalk om aan te geven dat het spel is gestart
        const titleBar = document.querySelector('.title-bar');
        if (titleBar) {
            titleBar.textContent = "Spel gestart!";
        }

        // Hier kun je andere logica toevoegen voor het starten van het spel (zoals het weergeven van stenen, scores, enz.)
    };

    // Simuleer een korte vertraging om te testen (in een echte situatie zou dit gebeuren wanneer spelers worden toegevoegd)
    setTimeout(checkStartCondition, 3000); // Wacht 3 seconden voor test

    // Simuleer het toevoegen van spelers
    // Wanneer een speler wordt toegevoegd, wordt het aantal opgeslagen in localStorage
    // Voorbeeld: Voeg spelers toe door dit handmatig aan te roepen
    // localStorage.setItem('playerCount', playerCount + 1); // Wanneer een speler zich aanmeldt
});
