
const tileTypeToImage = {
    0: '../images/startingtTile.png',
    11: '../images/yellowRed.png',
    12: '../images/plainRed.png',
    13: '../images/blackBlue.png',
    14: '../images/whiteTurquoise.png',
    15: '../images/plainBlue.png'
};
document.addEventListener('DOMContentLoaded', async () => {


    const token = sessionStorage.getItem('token');
    const tableId = sessionStorage.getItem('tableId');
    const username = sessionStorage.getItem('username');



    if (!token || !tableId || !username) {
        console.error('Token, tableId of username ontbreekt. Terug naar lobby.');
        window.location.href = "lobby.html";
        return;
    }

    try {
        const tableData = await fetchTableData(tableId, token);
        const gameId = tableData.gameId;
        document.getElementById('gameIdValue').textContent = gameId;

        const gameData = await fetchGameData(gameId, token);

        const selfPlayer = gameData.players.find(p => p.name === username);
        const viewerId = selfPlayer?.id;

        renderBoardsAndFactory(gameData, viewerId);
        renderScores(gameData.players);

        if (selfPlayer) {
            document.getElementById('playerName').textContent = `Speler: ${selfPlayer.name}`;
        }

        const activePlayer = gameData.players.find(p => p.id === gameData.playerToPlayId);
        document.getElementById('activePlayer').textContent = `Aan de beurt: ${activePlayer?.name || 'Onbekend'}`;
    } catch (err) {
        console.error('Fout tijdens initialisatie game:', err);
    }

    document.getElementById('leave').addEventListener('click', () => leaveTable(token, tableId));
});

async function fetchTableData(tableId, token) {
    const res = await fetch(`https://localhost:5051/api/Tables/${tableId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Fout bij ophalen tableData");
    return await res.json();
}

async function fetchGameData(gameId, token) {
    const res = await fetch(`https://localhost:5051/api/Games/${gameId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Fout bij ophalen gameData");
    return await res.json();
}

function renderBoardsAndFactory(gameData, viewerId) {
    const container = document.getElementById('boardsContainer');
    container.innerHTML = '';

    const spots = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const sortedPlayers = [...gameData.players].sort((a, b) => a.id === viewerId ? -1 : 0);

    console.group("🧩 Spelerborden");

    sortedPlayers.forEach((player, index) => {
        console.group(`👤 Speler: ${player.name}`);
        console.log("📋 Pattern Lines:", player.board.patternLines);
        console.log("🧱 Wall:", player.board.wall);
        console.log("🧹 Floor Line:", player.board.floorLine);
        console.log("⭐ Score:", player.board.score);
        console.log("🏁 Heeft start-tegel:", player.hasStartingTile);
        console.log("🎯 Tiles to place:", player.tilesToPlace);

        const board = document.createElement('div');
        board.className = `board ${spots[index]}`;
        if (player.id === gameData.playerToPlayId) {
            board.classList.add('current-player');
        }

        board.innerHTML = `
            <div class="board-top">
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
                    ${ player.board.wall.map(row => 
                    row.map(cell => {
                        if (cell.type) {
                            if (cell.type > 15){
                                cell.type -= 5;
                            }
                            const src = tileTypeToImage[cell.type] || '../images/unknown.png';
                            return `<img src="${src}" class="tile-image board-tile" alt="Tile ${cell.type}">`;
                        } else {
                            return `<div class="tile empty-tile"></div>`;
                        }
                    }).join('')
                ).join('')
                }
               </div>

            </div>
            <div class="floor-line-container">
                <div class="floor-line-numbers">
                    <span>-1</span><span>-1</span><span>-2</span><span>-2</span><span>-2</span><span>-3</span><span>-3</span>
                </div>
                <div class="floor-line-tiles">
                    ${'<div class="penalty-tile"></div>'.repeat(7)}
                </div>
            </div>
            <div class="player-name">${player.name}</div>
        `;
        container.appendChild(board);

        console.groupEnd();
    });

    console.groupEnd();

    const center = document.createElement('div');
    center.className = 'circle-container';

    const factories = gameData.tileFactory.displays;
    const tableCenter = gameData.tileFactory.tableCenter;

    console.group("🏭 Fabrieken");
    console.log("🔁 Aantal displays:", factories.length);
    console.log("🎯 Verwachte fabrieken voor", gameData.players.length, "spelers:", { 2: 5, 3: 7, 4: 9 }[gameData.players.length] || factories.length);
    console.log("📦 Table Center:", tableCenter);

    const playerCount = gameData.players.length;
    const expected = { 2: 5, 3: 7, 4: 9 }[playerCount] || factories.length;
    factories.slice(0, expected).forEach((disc, i) => {
        console.group(`🌀 Fabriek #${i + 1}`);
        console.log("ID:", disc.id);
        console.log("Tegels:", disc.tiles);
        console.groupEnd();

        const el = document.createElement('div');
        el.className = 'circle';
        el.innerHTML = `
            <div class="tile-grid">
                ${disc.tiles.map(tile => {
            const src = tileTypeToImage[tile];
            return `<img src="${src}" class="tile-image" alt="Tile ${tile}">`;
        }).join('')}
            </div>
        `;
        center.appendChild(el);
    });
    console.groupEnd();

    container.appendChild(center);

    const round = document.getElementById('roundInfo');
    round.textContent = `Ronde ${gameData.roundNumber}`;
}


function renderScores(players) {
    const scorePanel = document.getElementById('scorePanel');
    scorePanel.innerHTML = '';
    players.forEach(p => {
        const el = document.createElement('div');
        el.textContent = `${p.name}: ${p.score}`;
        scorePanel.appendChild(el);
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