document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('token');
    const tableId = sessionStorage.getItem('tableId');

    if (!token || !tableId) {
        console.error('Token of tableId ontbreekt. Terug naar lobby.');
        window.location.href = "lobby.html";
        return;
    }

    try {
        const tableData = await fetchTableData(tableId, token);
        const gameId = tableData.gameId;
        document.getElementById('gameIdValue').textContent = gameId;

        const gameData = await fetchGameData(gameId, token);

        renderBoards(gameData.players, gameData.playerToPlayId);
        renderFactory(gameData.tileFactory, gameData.players.length);
        renderScores(gameData.players);
        const currentPlayer = gameData.players.find(player => player.id === gameData.playerToPlayId);
        document.getElementById('playerName').textContent = `Speler: ${currentPlayer.name}`;
    } catch (error) {
        console.error('Fout tijdens initialisatie game:', error);
    }

    const leaveButton = document.querySelector('#leave');
    if (leaveButton) {
        leaveButton.addEventListener('click', () => leaveTable(token, tableId));
    }
});


async function fetchTableData(tableId, token) {
    const response = await fetch(`https://localhost:5051/api/Tables/${tableId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Fout bij ophalen tableData');
    return await response.json();
}

async function fetchGameData(gameId, token) {
    const response = await fetch(`https://localhost:5051/api/Games/${gameId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Fout bij ophalen gameData');

    const gameData = await response.json();
    console.log("Volledige gameData:", gameData);
    return gameData;
}

function renderBoards(players, currentPlayerId) {
    const boardsContainer = document.getElementById('boardsContainer');
    boardsContainer.innerHTML = '';

    players.forEach(player => {
        const board = document.createElement('div');
        board.classList.add('board');
        if (player.id === currentPlayerId) {
            board.classList.add('current-player');
        }

        board.setAttribute('data-player-id', player.id);

        board.innerHTML = `
            <div class="pattern-wall">
                <div class="pattern-row"><div class="tile"></div></div>
                <div class="pattern-row"><div class="tile"></div><div class="tile"></div></div>
                <div class="pattern-row"><div class="tile"></div><div class="tile"></div><div class="tile"></div></div>
                <div class="pattern-row"><div class="tile"></div><div class="tile"></div><div class="tile"></div><div class="tile"></div></div>
                <div class="pattern-row"><div class="tile"></div><div class="tile"></div><div class="tile"></div><div class="tile"></div><div class="tile"></div></div>
            </div>

            <div class="arrows">
                <div>▶</div><div>▶</div><div>▶</div><div>▶</div><div>▶</div>
            </div>

            <div class="wall-grid">
                ${'<div class="tile"></div>'.repeat(25)}
            </div>

            <div class="floor-line">
                <div class="penalty">-1</div><div class="penalty">-1</div><div class="penalty">-2</div>
                <div class="penalty">-2</div><div class="penalty">-2</div><div class="penalty">-3</div><div class="penalty">-3</div>
            </div>
        `;

        boardsContainer.appendChild(board);
    });
}

function renderFactory(tileFactory, playerCount) {
    const factoryContainer = document.getElementById('factoryContainer');
    factoryContainer.innerHTML = '';

    const expectedFactories = { 2: 5, 3: 7, 4: 9 }[playerCount] || 0;


    tileFactory.displays.slice(0, expectedFactories).forEach(disc => {
        const discElement = document.createElement('div');
        discElement.classList.add('circle');
        discElement.textContent = disc.tiles.join(', ');
        factoryContainer.appendChild(discElement);
    });
}

function renderScores(players) {
    const scorePanel = document.getElementById('scorePanel');
    scorePanel.innerHTML = '';

    players.forEach(player => {
        const playerScore = document.createElement('div');
        playerScore.textContent = `${player.name}: ${player.score}`;
        scorePanel.appendChild(playerScore);
    });
}

async function leaveTable(token, tableId) {
    try {
        await fetch(`https://localhost:5051/api/Tables/${tableId}/leave`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (err) {
        console.error('Fout bij verlaten tafel:', err);
    } finally {
        window.location.href = "lobby.html";
    }
}
