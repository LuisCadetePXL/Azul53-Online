const tileTypeToImage = {
    0: './images/startingtTile.png',
    11: './images/yellowRed.png',
    12: './images/plainRed.png',
    13: './images/blackBlue.png',
    14: './images/whiteTurquoise.png',
    15: './images/plainBlue.png'
};

// Game state
let currentGameData = null;
let currentPlayerId = null;
let currentUsername = null;
let selectedTiles = {
    count: 0,
    type: null,
    fromCenter: false,
    factoryId: null,
    includesStarterTile: false
};

document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('token');
    const tableId = sessionStorage.getItem('tableId');
    currentUsername = sessionStorage.getItem('username');

    if (!token || !tableId || !currentUsername) {
        window.location.href = "lobby.html";
        return;
    }

    try {
        const tableData = await fetchTableData(tableId, token);
        const gameId = tableData.gameId;
        document.getElementById('gameIdValue').textContent = gameId;

        await loadAndRenderGame(gameId, token);

        setupTileSelection();
        setupSelectionEventListeners();
    } catch (err) {
        console.error('Initialisatie fout:', err);
        showNotification('Fout bij laden van het spel');
    }

    document.getElementById('leave').addEventListener('click', () => leaveTable(token, tableId));
});

async function loadAndRenderGame(gameId, token) {
    const gameData = await fetchGameData(gameId, token);
    currentGameData = gameData;

    const selfPlayer = gameData.players.find(p => p.name === currentUsername);
    currentPlayerId = selfPlayer?.id;

    renderBoardsAndFactory(gameData);
    renderScores(gameData.players);

    if (selfPlayer) {
        document.getElementById('playerName').textContent = `Speler: ${selfPlayer.name}`;
    }

    updateActivePlayerDisplay(gameData);
}

function renderBoardsAndFactory(gameData) {
    const container = document.getElementById('boardsContainer');
    container.innerHTML = '';

    const spots = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const sortedPlayers = [...gameData.players].sort((a, b) => a.id === currentPlayerId ? -1 : 0);

    sortedPlayers.forEach((player, index) => {
        const board = document.createElement('div');
        board.className = `board ${spots[index]}`;
        if (player.id === gameData.playerToPlayId) {
            board.classList.add('current-player');
        }

        // Defensieve checks voor board structuur
        const patternLines = player.board?.patternLines || Array(5).fill().map((_, i) => ({ tiles: Array(i+1).fill(null) }));
        const wall = player.board?.wall || Array(5).fill().map(() => Array(5).fill(null));
        const floor = player.board?.floor || Array(7).fill(null);

        // Maak patroonrijen voor het bord
        const patternRows = patternLines.map((line, rowIndex) => {
            const tilesInRow = rowIndex + 1;
            const tiles = [];

            // Voeg bestaande tegels toe
            for (let i = 0; i < (line.tiles || []).length; i++) {
                const tile = line.tiles[i];
                if (tile) {
                    tiles.push(`<img src="${tileTypeToImage[tile]}" class="tile-image pattern-tile" 
                              data-tile-type="${tile}" data-row="${rowIndex}">`);
                } else {
                    tiles.push(`<div class="tile pattern-tile" data-row="${rowIndex}" data-pos="${i}"></div>`);
                }
            }

            // Vul aan met lege tegels indien nodig
            while (tiles.length < tilesInRow) {
                tiles.push(`<div class="tile pattern-tile" data-row="${rowIndex}" data-pos="${tiles.length}"></div>`);
            }

            return `<div class="pattern-row" data-row-index="${rowIndex}">${tiles.join('')}</div>`;
        }).join('');

        board.innerHTML = `
            <div class="board-top">
                <div class="pattern-wall">
                    ${patternRows}
                </div>
                <div class="arrows">
                    ${Array.from({length: 5}, () => '<div>▶</div>').join('')}
                </div>
                
                <div class="wall-grid">
                    ${wall.map((row, rowIdx) =>
            row.map((cell, colIdx) => {
                if (cell) {
                    const src = tileTypeToImage[cell.type] || '../images/unknown.png';
                    return `<img src="${src}" class="tile-image board-tile" 
                                        alt="Tile ${cell.type}" data-row="${rowIdx}" data-col="${colIdx}">`;
                }
                return `<div class="tile empty-tile" data-row="${rowIdx}" data-col="${colIdx}"></div>`;
            }).join('')
        ).join('')}
                </div>
            </div>
            <div class="floor-line-container">
                <div class="floor-line-numbers">
                    ${[-1, -1, -2, -2, -2, -3, -3].map((val, i) =>
            `<span data-pos="${i}">${val}</span>`
        ).join('')}
                </div>
                <div class="floor-line-tiles" id="floor-line-${player.id}">
                    ${floor.map((tile, i) =>
            tile ? `<img src="${tileTypeToImage[tile]}" class="tile-image floor-tile" 
                              data-tile-type="${tile}" data-pos="${i}">`
                : `<div class="penalty-tile" data-pos="${i}"></div>`
        ).join('')}
                </div>
            </div>
            <div class="player-name">${player.name}</div>
        `;
        container.appendChild(board);
    });

    renderFactoryDisplays(gameData, container);

    document.getElementById('roundInfo').textContent = `Ronde ${gameData.roundNumber}`;
}

function renderFactoryDisplays(gameData, container) {
    const center = document.createElement('div');
    center.className = 'circle-container';

    const factories = gameData.tileFactory.displays;
    const tableCenter = gameData.tileFactory.tableCenter;
    const playerCount = gameData.players.length;
    const expected = { 2: 5, 3: 7, 4: 9 }[playerCount] || factories.length;

    const radius = 125;
    const centerX = 150;
    const centerY = 150;

    factories.slice(0, expected).forEach((disc, i) => {
        const angle = (2 * Math.PI / expected) * i;
        const x = centerX + radius * Math.cos(angle) - 35;
        const y = centerY + radius * Math.sin(angle) - 35;

        const el = document.createElement('div');
        el.className = 'circle';
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.dataset.factoryId = disc.id;

        el.innerHTML = `
            <div class="tile-grid">
                ${disc.tiles.map(tile => {
            const src = tileTypeToImage[tile];
            return `<img src="${src}" class="tile-image factory-tile" 
                            alt="Tile ${tile}" data-tile-type="${tile}">`;
        }).join('')}
            </div>
        `;
        center.appendChild(el);
    });

    const centerCircle = document.createElement('div');
    centerCircle.className = 'circle center-circle';
    centerCircle.dataset.factoryId = tableCenter.id;
    centerCircle.innerHTML = `
        <div class="tile-grid">
            ${tableCenter.tiles.map(tile => {
        const src = tileTypeToImage[tile];
        return `<img src="${src}" class="tile-image center-tile" 
                        alt="Tile ${tile}" data-tile-type="${tile}">`;
    }).join('')}
        </div>
    `;
    center.appendChild(centerCircle);

    container.appendChild(center);
}

function setupTileSelection() {
    document.addEventListener('click', async (e) => {
        if (selectedTiles.count > 0) return;

        if (!e.target.classList.contains('factory-tile') &&
            !e.target.classList.contains('center-tile')) {
            return;
        }

        const tileImg = e.target;
        const factoryCircle = tileImg.closest('.circle');

        if (!factoryCircle) return;

        if (currentPlayerId !== currentGameData?.playerToPlayId) {
            showNotification('Het is niet jouw beurt!');
            return;
        }

        const token = sessionStorage.getItem('token');
        const gameId = document.getElementById('gameIdValue').textContent;
        const tileType = parseInt(tileImg.dataset.tileType);
        const fromCenter = factoryCircle.classList.contains('center-circle');
        const factoryId = factoryCircle.dataset.factoryId;

        try {
            // Verplaats tegels visueel voordat we de API aanroepen
            const allTilesInFactory = Array.from(factoryCircle.querySelectorAll('.tile-image'));
            const tilesToTake = allTilesInFactory.filter(tile =>
                parseInt(tile.dataset.tileType) === tileType
            );
            const tilesToCenter = allTilesInFactory.filter(tile =>
                parseInt(tile.dataset.tileType) !== tileType
            );

            // Verplaats tegels naar center circle
            if (tilesToCenter.length > 0) {
                const centerCircle = document.querySelector('.center-circle .tile-grid');
                tilesToCenter.forEach(tile => {
                    tile.classList.remove('selected');
                    centerCircle.appendChild(tile);
                });
            }

            // Markeer geselecteerde tegels
            tilesToTake.forEach(tile => tile.classList.add('selected'));

            // Update selected tiles state
            selectedTiles = {
                count: tilesToTake.length,
                type: tileType,
                fromCenter: fromCenter,
                factoryId: factoryId,
                includesStarterTile: fromCenter && tileType === 0
            };

            // Toon de tegels die verplaatst moeten worden
            showTilesToMove(tilesToTake, tileType, fromCenter);

            if (allTilesInFactory.length === tilesToCenter.length + tilesToTake.length) {
                factoryCircle.innerHTML = ``;
            }

            // Maak API call om de actie te bevestigen
            const response = await fetch(`https://localhost:5051/api/Games/${gameId}/take-tiles`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    displayId: factoryId,
                    tileType: tileType
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Fout bij verwerken zet');
            }

        } catch (err) {
            console.error('Fout bij take-tiles:', err);
            showNotification(err.message || 'Fout bij uitvoeren zet');
        }
    });
}

function showTilesToMove(tiles, tileType, fromCenter) {

    const moveContainer = document.createElement('tiles-to-move-container');
    moveContainer.innerHTML = `
        <div class="tiles-preview">
            ${Array.from({length: tiles.length}, () =>
        `<img src="${tileTypeToImage[tileType]}" class="tile-image" alt="Tile ${tileType}">`
    ).join('')}
            ${fromCenter ? '<img src="' + tileTypeToImage[0] + '" class="tile-image" alt="Starter Tile">' : ''}
        </div>
    `;

    document.body.appendChild(moveContainer);
}

function setupSelectionEventListeners() {
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('row-option') && !e.target.disabled) {
            const rowIndex = parseInt(e.target.dataset.row);
            await placeTilesOnPatternLine(rowIndex);
        }
        else if (e.target.classList.contains('floor-option')) {
            await placeTilesOnFloorLine();
        }
    });
}

async function placeTilesOnPatternLine(rowIndex) {
    const token = sessionStorage.getItem('token');
    const gameId = document.getElementById('gameIdValue').textContent;

    try {
        const response = await fetch(`https://localhost:5051/api/Games/${gameId}/place-tiles-on-patternline`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                patternLineIndex: rowIndex
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Fout bij plaatsen tegels');
        }

        await loadAndRenderGame(gameId, token);
        showNotification(`Tegels succesvol geplaatst in rij ${rowIndex + 1}!`);

    } catch (err) {
        console.error('Fout bij plaatsen tegels:', err);
        showNotification(err.message || 'Fout bij plaatsen tegels');
    } finally {
        resetSelection();
    }
}

async function placeTilesOnFloorLine() {
    const token = sessionStorage.getItem('token');
    const gameId = document.getElementById('gameIdValue').textContent;

    try {
        const response = await fetch(`https://localhost:5051/api/Games/${gameId}/place-tiles-on-patternline`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                patternLineIndex: -1
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Fout bij plaatsen op vloerlijn');
        }

        await loadAndRenderGame(gameId, token);
        showNotification('Tegels succesvol op vloerlijn geplaatst!');

    } catch (err) {
        console.error('Fout bij plaatsen op vloerlijn:', err);
        showNotification(err.message || 'Fout bij plaatsen op vloerlijn');
    } finally {
        resetSelection();
    }
}

function resetSelection() {
    selectedTiles = {
        count: 0,
        type: null,
        fromCenter: false,
        factoryId: null,
        includesStarterTile: false
    };
    document.querySelectorAll('.tile-image.selected').forEach(t => t.classList.remove('selected'));
    const panel = document.querySelector('.selection-panel');
    if (panel) panel.remove();
    const moveContainer = document.querySelector('.tiles-to-move-container');
    if (moveContainer) moveContainer.remove();
}

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

function renderScores(players) {
    const scorePanel = document.getElementById('scorePanel');
    scorePanel.innerHTML = '';

    players.forEach(player => {
        const playerScore = document.createElement('div');
        playerScore.textContent = `${player.name}: ${player.score ?? 0}`;
        scorePanel.appendChild(playerScore);
    });
}

function updateActivePlayerDisplay(gameData) {
    const activePlayer = gameData.players.find(p => p.id === gameData.playerToPlayId);
    const activePlayerDisplay = document.getElementById('activePlayer');
    activePlayerDisplay.textContent = `Aan de beurt: ${activePlayer?.name || 'Onbekend'}`;

    if (currentPlayerId === gameData.playerToPlayId) {
        activePlayerDisplay.classList.add('your-turn');
        activePlayerDisplay.classList.remove('not-your-turn');
    } else {
        activePlayerDisplay.classList.add('not-your-turn');
        activePlayerDisplay.classList.remove('your-turn');
    }
}

function showNotification(message) {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) existingNotification.remove();

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
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