document.addEventListener('DOMContentLoaded', () => {
    const createTableButton = document.getElementById('createTableButton');
    const playerCountSelect = document.querySelector('.playerCountSelect');
    const tablesList = document.getElementById('tablesList');
    const errorMessage = document.querySelector('.errorMessage');
    const logoutButton = document.getElementById('logOutButton');
    const token = sessionStorage.getItem('token');

    createTableButton.addEventListener('click', async () => {
        const selectedValue = playerCountSelect.value;

        if (!selectedValue) {
            errorMessage.textContent = "Kies eerst het aantal spelers.";
            return;
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

            if (!response.ok) {
                console.error('Error response:', response);
                return;
            }

            const text = await response.text();
            if (text) {
                const tableData = JSON.parse(text);
                console.log('Tafel gevonden/gemaakt:', tableData);
                displayTable(tableData);
            } else {
                console.error('Lege response ontvangen.');
            }
        } catch (error) {
            console.error('Fout bij het zoeken/maken van tafel:', error);
        }
    });

    function displayTable(tableData) {
        const existingTable = document.getElementById(`table-${tableData.id}`);
        if (existingTable) {
            updateTable(existingTable, tableData);
        } else {
            const tableCard = document.createElement('div');
            tableCard.classList.add('table-card');
            tableCard.id = `table-${tableData.id}`;

            const seatedPlayers = tableData.seatedPlayers.length;
            const totalSeats = tableData.preferences.numberOfPlayers;

            tableCard.innerHTML = `
                <p><strong>Spelers:</strong> ${seatedPlayers} / ${totalSeats}</p>
                <p>${seatedPlayers < totalSeats ? 'Wachten op meer spelers...' : 'Alle spelers aanwezig! Het spel start.'}</p>
            `;

            for (let i = 0; i < seatedPlayers; i++) {
                const player = tableData.seatedPlayers[i];
                const playerName = player.name || player.userName || "Onbekende speler";
                tableCard.innerHTML += ` <p>${playerName}</p>`;
            }

            const leaveButton = document.createElement('button');
            leaveButton.textContent = 'Tafel verlaten';
            leaveButton.classList.add('leave-button');
            leaveButton.addEventListener('click', async () => {
                try {
                    const response = await fetch(`https://localhost:5051/api/Tables/${tableData.id}/leave`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        console.log('Succesvol verlaten.');
                        tableCard.remove();
                    } else {
                        console.error('Fout bij verlaten:', response.status);
                    }
                } catch (error) {
                    console.error('Fout bij fetch verlaten:', error);
                }
            });

            tableCard.appendChild(leaveButton);
            tablesList.appendChild(tableCard);

            const checkTableInterval = setInterval(() => {
                getTableData(tableData.id, checkTableInterval);
            }, 1000);  
        }
    }

    function updateTable(tableCard, tableData) {
        const seatedPlayers = tableData.seatedPlayers.length;
        const totalSeats = tableData.preferences.numberOfPlayers;

        tableCard.innerHTML = `
                <p><strong>Spelers:</strong> ${seatedPlayers} / ${totalSeats}</p>
                <p>${seatedPlayers < totalSeats ? 'Wachten op meer spelers...' : 'Alle spelers aanwezig! Het spel start.'}</p>
            `;

        for (let i = 0; i < seatedPlayers; i++) {
            const player = tableData.seatedPlayers[i];
            tableCard.innerHTML += ` <p>${player.name}</p>`;
        }

        const leaveButton = document.createElement('button');
        leaveButton.textContent = 'Tafel verlaten';
        leaveButton.classList.add('leave-button');
        leaveButton.addEventListener('click', async () => {
            try {
                const response = await fetch(`https://localhost:5051/api/Tables/${tableData.id}/leave`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    console.log('Succesvol verlaten.');
                    tableCard.remove();
                } else {
                    console.error('Fout bij verlaten:', response.status);
                }
            } catch (error) {
                console.error('Fout bij fetch verlaten:', error);
            }
        });
        tableCard.appendChild(leaveButton);
    }

    async function getTableData(tableId, checkTableInterval) {
        try {
            const response = await fetch(`https://localhost:5051/api/Tables/${tableId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const tableData = await response.json();
                const existingTable = document.getElementById(`table-${tableData.id}`);
                if (existingTable) {
                    updateTable(existingTable, tableData);
                }

                if (tableData.seatedPlayers.length >= tableData.preferences.numberOfPlayers) {
                    clearInterval(checkTableInterval);
                    window.location.href = "game.html";
                }
            } else {
                console.error('Fout bij ophalen tafel:', response.status);
            }
        } catch (error) {
            console.error('Fout bij fetch ophalen tafel:', error);
        }
    }

    logoutButton.addEventListener('click', () => {
        sessionStorage.removeItem('token');
        window.location.href = 'index.html';
    });
});
