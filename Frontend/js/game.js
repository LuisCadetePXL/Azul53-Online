const leaveButton = document.querySelector('#leave');

leaveButton.addEventListener('click', function () {
    window.location.href = "lobby.html"; 

});

document.addEventListener("DOMContentLoaded", () => {
    // Wacht tot de pagina volledig geladen is
    const checkStartCondition = () => {
        const boards = document.querySelectorAll('.board');

        if (boards.length === 4) {
            startGame();
        } else {
            console.log("Wachten op meer spelers...");
        }
    };

    const startGame = () => {
        // Hier definieer je wat er moet gebeuren als het spel begint
        console.log("Het spel begint!");

        // Voorbeeld: verander de titelbalk om dit aan te geven
        const titleBar = document.querySelector('.title-bar');
        if (titleBar) {
            titleBar.textContent = "Spel gestart!";
        }

        // Andere logica zoals het tonen van stenen, initialiseren van scores etc.
    };

    // Simuleer een korte vertraging om te checken (kan later vervangen worden door echte game lobby logica)
    setTimeout(checkStartCondition, 3000);
});
