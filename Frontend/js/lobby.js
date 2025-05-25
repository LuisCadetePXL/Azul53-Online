document.addEventListener('DOMContentLoaded', () => {
    const createTableButton = document.getElementById('createTableButton');
    const playerCountSelect = document.querySelector('.playerCountSelect');
    const tablesList = document.getElementById('tablesList');
    const errorMessage = document.querySelector('.errorMessage');
    const logoutButton = document.getElementById('logOutButton');
    const token = sessionStorage.getItem('token');
    const tableIntervals = new Map();
    const playerNameContainer = document.getElementById('playerName');
    const PlayerName = sessionStorage.getItem('username');
    let lobbyAudio = null; // Definieer lobbyAudio in de globale scope

    console.log('lobbyAudio geïnitialiseerd:', lobbyAudio); // Debug: controleer initiële waarde

    playerNameContainer.innerHTML = `${PlayerName}`;

    // Functie om muziek te stoppen
    function stopLobbyAudio() {
        if (lobbyAudio) {
            lobbyAudio.pause();
            lobbyAudio.currentTime = 0; // Reset naar begin
            console.log('Muziek gestopt en gereset.');
        } else {
            console.log('Geen lobbyAudio beschikbaar om te stoppen.');
        }
    }

    createTableButton.addEventListener('click', async () => {
        const selectedValue = playerCountSelect.value;
        if (!selectedValue) {
            errorMessage.textContent = "Kies eerst het aantal spelers.";
            return;
        }

        // Maak een Audio object voor lobby.mp3
        lobbyAudio = new Audio('music/lobby.mp3');
        lobbyAudio.loop = true; // Laat het liedje herhalen totdat het wordt gestopt
        console.log('lobbyAudio aangemaakt:', lobbyAudio); // Debug: controleer creatie

        // Probeer de audio af te spelen
        try {
            await lobbyAudio.play();
            console.log('Lobby muziek wordt afgespeeld.');
        } catch (error) {
            console.error('Fout bij het afspelen van lobby.mp3:', error);
            errorMessage.textContent = "Kan muziek niet afspelen. Controleer of het bestand bestaat en de browser toestemming heeft.";
        }

        const request = {
            numberOfPlayers: parseInt(selectedValue),
            numberOfArtificialPlayers: 0
        };

        try {
            const response = await fetch('https://localhost:5051/api/Tables/join-or-create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(request)
            });

            if (response.ok) {
                const text = await response.text();
                if (text) {
                    const tableData = JSON.parse(text);
                    displayTable(tableData);
                    sessionStorage.setItem('tableId', tableData.id);

                    // Start een functie om te checken of een andere speler join
                    checkForOtherPlayers(tableData.id, lobbyAudio);
                } else {
                    console.error('Lege response ontvangen.');
                    stopLobbyAudio();
                    errorMessage.textContent = "Geen gegevens ontvangen van de server.";
                }
            } else {
                console.error('Error response:', response.status, response.statusText);
                stopLobbyAudio();
                errorMessage.textContent = "Fout bij het aanmaken van de tafel.";
            }
        } catch (error) {
            console.error('Fout bij het zoeken/maken van tafel:', error);
            stopLobbyAudio();
            errorMessage.textContent = "Netwerkfout bij het verbinden met de server.";
        }
    });

    // Functie om te checken of een andere speler join
    async function checkForOtherPlayers(tableId, audio) {
        try {
            const checkInterval = setInterval(async () => {
                const response = await fetch(`https://localhost:5051/api/Tables/${tableId}/players`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    const players = await response.json();
                    console.log('Huidige spelers:', players);
                    // Als er meer dan 1 speler is (de huidige speler + een andere)
                    if (players.length > 1) {
                        if (audio) {
                            audio.pause();
                            audio.currentTime = 0;
                            console.log('Muziek gestopt omdat een andere speler is gejoind.');
                        }
                        clearInterval(checkInterval); // Stop met polling
                    }
                } else {
                    console.error('Fout bij het ophalen van spelers:', response.status, response.statusText);
                }
            }, 2000); // Check elke 2 seconden
        } catch (error) {
            console.error('Fout bij het checken van spelers:', error);
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        }
    }

    function displayTable(tableData) {
        if (document.getElementById(`table-${tableData.id}`)) {
            return;
        }

        const tableCard = document.createElement('div');
        tableCard.classList.add('table-card');
        tableCard.id = `table-${tableData.id}`;

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('content');
        tableCard.appendChild(contentDiv);

        const leaveButton = document.createElement('button');
        leaveButton.textContent = 'Tafel verlaten';
        leaveButton.classList.add('leave-button');
        leaveButton.addEventListener('click', () => leaveTable(tableData.id, tableCard));

        tableCard.appendChild(leaveButton);
        tablesList.appendChild(tableCard);

        updateTableContent(tableCard, tableData);

        const intervalId = setInterval(() => {
            if (document.body.contains(tableCard)) {
                getTableData(tableData.id, tableCard);
            } else {
                clearInterval(intervalId);
                tableIntervals.delete(tableData.id);
            }
        }, 1000);

        tableIntervals.set(tableData.id, intervalId);
    }

    async function leaveTable(tableId, tableCard) {
        console.log('leaveTable aangeroepen, lobbyAudio status:', lobbyAudio); // Debug: controleer lobbyAudio
        try {
            const response = await fetch(`https://localhost:5051/api/Tables/${tableId}/leave`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                console.error('Fout bij verlaten:', response.status);
            }
        } catch (error) {
            console.error('Fout bij fetch verlaten:', error);
        } finally {
            const intervalId = tableIntervals.get(tableId);
            if (intervalId) {
                clearInterval(intervalId);
                tableIntervals.delete(tableId);
            }
            if (tableCard) {
                tableCard.remove();
            }
            stopLobbyAudio(); // Stop de muziek expliciet
        }
    }

    async function getTableData(tableId, tableCard) {
        try {
            const response = await fetch(`https://localhost:5051/api/Tables/${tableId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const tableData = await response.json();

                if (!tableData || !tableData.seatedPlayers) {
                    console.error('Ongeldige tafel data ontvangen.');
                    return;
                }

                updateTableContent(tableCard, tableData);

                if (tableData.seatedPlayers.length === 0) {
                    const intervalId = tableIntervals.get(tableId);
                    if (intervalId) {
                        clearInterval(intervalId);
                        tableIntervals.delete(tableId);
                    }
                    if (tableCard) {
                        tableCard.remove();
                    }
                    console.log('Tafel leeg -> kaart verwijderd, interval gestopt.');
                }

                if (tableData.seatedPlayers.length >= tableData.preferences.numberOfPlayers) {
                    const intervalId = tableIntervals.get(tableId);
                    if (intervalId) {
                        clearInterval(intervalId);
                        tableIntervals.delete(tableId);
                    }
                    window.location.href = "game.html";
                }
            } else {
                console.error('Fout bij ophalen tafel:', response.status);
            }
        } catch (error) {
            console.error('Fout bij fetch ophalen tafel:', error);
        }
    }

    function updateTableContent(tableCard, tableData) {
        const contentDiv = tableCard.querySelector('.content');

        if (!contentDiv) {
            console.error('Geen content div gevonden.');
            return;
        }

        const seatedPlayers = tableData.seatedPlayers.length;
        const totalSeats = tableData.preferences.numberOfPlayers;

        contentDiv.innerHTML = `
            <p><strong>Spelers:</strong> ${seatedPlayers} / ${totalSeats}</p>
            <p>${seatedPlayers < totalSeats ? 'Wachten op meer spelers...' : 'Alle spelers aanwezig! Het spel start.'}</p>
        `;

        tableData.seatedPlayers.forEach(player => {
            const playerName = player.name || player.userName || "Onbekende speler";
            contentDiv.innerHTML += `<p>${playerName}</p>`;
        });
    }

    logoutButton.addEventListener('click', () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('username');
        window.location.href = 'index.html';
    });
});