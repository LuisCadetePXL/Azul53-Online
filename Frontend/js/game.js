const tileTypeToImage = {
    0: './images/startingTile.png',
    11: './images/yellowRed.png',
    12: './images/plainRed.png',
    13: './images/blackBlue.png',
    14: './images/whiteTurquoise.png',
    15: './images/plainBlue.png',
    null: '../images/unknown.png',
    getImage(type) {
        const image = this[type];
        if (!image) {
            console.warn(`Onbekende tileType: ${type}`);
            return this[null];
        }
        return image;
    }
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
let pollingInterval = null;
let firstPlayerNextRound = null;

// Azul wall pattern
const wallPatterns = [
    [15, 11, 12, 13, 14], // Rij 0: blauw, geel, rood, zwart, wit
    [14, 15, 11, 12, 13], // Rij 1: wit, blauw, geel, rood, zwart
    [13, 14, 15, 11, 12], // Rij 2: zwart, wit, blauw, geel, rood
    [12, 13, 14, 15, 11], // Rij 3: rood, zwart, wit, blauw, geel
    [11, 12, 13, 14, 15]  // Rij 4: geel, rood, zwart, wit, blauw
];

document.addEventListener('DOMContentLoaded', async () => {
    const token = sessionStorage.getItem('token');
    const tableId = sessionStorage.getItem('tableId');
    currentUsername = sessionStorage.getItem('username');

    if (!token || !tableId || !currentUsername) {
        console.error('Missing token, tableId, or username');
        window.location.href = "lobby.html";
        return;
    }

    try {
        const tableData = await fetchTableData(tableId, token);
        const gameId = tableData.gameId;
        document.getElementById('gameIdValue').textContent = gameId;

        await loadAndRenderGame(gameId, token);

        startPolling(gameId, token);

        setupTileSelection();
        setupSelectionEventListeners();
    } catch (err) {
        console.error('Initialisatie fout:', err);
        showNotification('Fout bij laden van het spel');
    }

    document.getElementById('leave').addEventListener('click', () => {
        stopPolling();
        leaveTable(token, tableId);
    });
});

function startPolling(gameId, token) {
    stopPolling();
    pollingInterval = setInterval(async () => {
        try {
            const gameData = await fetchGameData(gameId, token);
            if (!gameData) {
                throw new Error('Geen speldata ontvangen');
            }
            currentGameData = gameData;

            renderBoardsAndFactory(gameData);
            renderScores(gameData.players);
            updateActivePlayerDisplay(gameData); // Toegevoegd

            if (isRoundOver(gameData)) {
                await handleEndOfRound(gameId, token);
            }

            if (gameData?.hasEnded) {
                stopPolling();
                showNotification('Spel geëindigd! Een speler heeft een horizontale rij voltooid.');
                await displayFinalScores(gameId, token);
            }
        } catch (err) {
            console.error('Polling error:', err);
            showNotification('Error bij verversen spelstatus: ' + err.message);
            stopPolling();
            await loadAndRenderGame(gameId, token); // Retry rendering
        }
    }, 2000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

async function loadAndRenderGame(gameId, token) {
    try {
        const gameData = await fetchGameData(gameId, token);
        if (!gameData) {
            throw new Error('Geen speldata ontvangen');
        }
        currentGameData = gameData;

        const selfPlayer = gameData.players.find(p => p.name === currentUsername);
        currentPlayerId = selfPlayer?.id;

        console.log('Game Data:', JSON.stringify(gameData, null, 2));

        if (!gameData.players || gameData.players.length === 0) {
            console.error('Geen spelers gevonden in gameData');
            showNotification('Fout: Geen spelersdata beschikbaar');
            return;
        }

        renderBoardsAndFactory(gameData);
        renderScores(gameData.players);

        if (selfPlayer) {
            document.getElementById('playerName').textContent = `Speler: ${selfPlayer.name}`;
        }

        updateActivePlayerDisplay(gameData);
    } catch (err) {
        console.error('Error loading game:', err);
        showNotification('Fout bij laden van speldata: ' + err.message);
        throw err;
    }
}

function renderBoardsAndFactory(gameData) {
    console.log('Rendering game data:', gameData);
    const container = document.getElementById('boardsContainer');
    if (!container) {
        console.error('boardsContainer element niet gevonden');
        showNotification('Fout: Spelborden container niet gevonden');
        return;
    }
    container.innerHTML = '';

    if (!gameData.players || !Array.isArray(gameData.players)) {
        console.error('Ongeldige spelersdata:', gameData.players);
        showNotification('Fout: Ongeldige spelersdata');
        return;
    }

    const spots = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const sortedPlayers = [...gameData.players].sort((a, b) => a.id === currentPlayerId ? -1 : b.id === currentPlayerId ? 1 : 0);

    sortedPlayers.forEach((player, index) => {
        const board = document.createElement('div');
        board.className = `board ${spots[index % spots.length]}`;
        if (player.id === gameData.playerToPlayId) {
            board.classList.add('current-player');
        }

        const patternLines = Array(5).fill().map((_, rowIndex) => {
            const apiLine = player.board?.patternLines?.[rowIndex] || { length: rowIndex + 1, tileType: null, numberOfTiles: 0, isComplete: false };
            const tiles = Array(rowIndex + 1).fill(null);
            for (let i = 0; i < apiLine.numberOfTiles && i < tiles.length; i++) {
                tiles[tiles.length - 1 - i] = apiLine.tileType; // Fill from right to left
            }
            return { tiles };
        });

        let wall = Array(5).fill().map(() => Array(5).fill(null));
        if (player.board?.wall && Array.isArray(player.board.wall)) {
            player.board.wall.forEach((tile, idx) => {
                const row = Math.floor(idx / 5);
                const col = idx % 5;
                if (row < 5 && col < 5 && tile != null) {
                    wall[row][col] = Number(tile) || null;
                }
            });
        }
        console.log(`Wall voor speler ${player.name}:`, wall);

        const penaltyLine = player.board?.floorLine?.map(f => f.hasTile ? f.type : null) || Array(7).fill(null);
        const penalties = player.board?.penalties || 0;

        const patternRows = patternLines.map((line, rowIndex) => {
            const tilesInRow = rowIndex + 1;
            const tiles = line.tiles || Array(tilesInRow).fill(null);

            return `<div class="pattern-row" data-row-index="${rowIndex}">${tiles.map((tile, i) =>
                tile !== null
                    ? `<img src="${tileTypeToImage.getImage(tile)}" class="tile-image pattern-tile" data-tile-type="${tile}" data-row="${rowIndex}" data-pos="${i}">`
                    : `<div class="tile pattern-tile" data-row="${rowIndex}" data-pos="${i}"></div>`
            ).join('')}</div>`;
        }).join('');

        board.innerHTML = `
            <div class="board-top">
                <div class="pattern-wall">
                    ${patternRows}
                </div>
                <div class="arrows">
                    ${Array.from({ length: 5 }, () => '<div>▶</div>').join('')}
                </div>
                <div class="wall-grid">
                    ${wallPatterns.map((row, rowIdx) =>
            row.map((expectedTileType, colIdx) => {
                const tile = wall[rowIdx][colIdx];
                if (tile !== null) {
                    const src = tileTypeToImage.getImage(tile);
                    return `<img src="${src}" class="tile-image board-tile placed-tile" alt="Tile ${tile}" data-row="${rowIdx}" data-col="${colIdx}" data-tile-type="${tile}">`;
                }
                const src = tileTypeToImage.getImage(expectedTileType);
                return `<img src="${src}" class="tile-image board-tile empty-tile" alt="Expected Tile ${expectedTileType}" data-row="${rowIdx}" data-col="${colIdx}" data-tile-type="${expectedTileType}" style="opacity: 0.3;">`;
            }).join('')
        ).join('')}
                </div>
            </div>
            <div class="floor-line-container">
                <div class="floor-line-numbers">
                    ${[-1, -1, -2, -2, -2, -3, -3].map((val, i) => `<span data-pos="${i}">${val}</span>`).join('')}
                </div>
                <div class="floor-line-tiles" id="penalty-line-${player.id}">
                    ${penaltyLine.map((tile, i) =>
            tile !== null
                ? `<img src="${tileTypeToImage.getImage(tile)}" class="tile-image penalty-tile" data-tile-type="${tile}" data-pos="${i}">`
                : `<div class="penalty-tile" data-pos="${i}"></div>`
        ).join('')}
                </div>
                <div class="penalties">Penalties: ${penalties}</div>
            </div>
            <div class="player-name">${player.name}</div>
        `;
        try {
            container.appendChild(board);
            console.log(`Board toegevoegd voor ${player.name} at spot ${spots[index % spots.length]}`);
        } catch (err) {
            console.error(`Fout bij toevoegen board voor ${player.name}:`, err);
            showNotification(`Fout bij toevoegen board voor ${player.name}`);
        }
    });

    renderFactoryDisplays(gameData, container);

    document.getElementById('roundInfo').textContent = `Ronde ${gameData.roundNumber || 0}`;
}

function renderFactoryDisplays(gameData, container) {
    const center = document.createElement('div');
    center.className = 'circle-container';

    const factories = gameData.tileFactory?.displays || [];
    const tableCenter = gameData.tileFactory?.tableCenter || { id: 'center', tiles: [] };
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
            const src = tileTypeToImage.getImage(tile);
            return `<img src="${src}" class="tile-image factory-tile" alt="Tile ${tile}" data-tile-type="${tile}">`;
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
        const src = tileTypeToImage.getImage(tile);
        return `<img src="${src}" class="tile-image center-tile" alt="Tile ${tile}" data-tile-type="${tile}">`;
    }).join('')}
        </div>
    `;
    center.appendChild(centerCircle);

    container.appendChild(center);
}

function setupTileSelection() {
    document.addEventListener('click', async (e) => {
        if (selectedTiles.count > 0) {
            showNotification('Plaats je geselecteerde tegels eerst!');
            return;
        }

        if (!e.target.classList.contains('factory-tile') && !e.target.classList.contains('center-tile')) {
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

        if (!factoryId || tileType == null) {
            showNotification('Ongeldige selectie: Factory ID of tileType ontbreekt');
            return;
        }

        const factory = fromCenter
            ? currentGameData.tileFactory.tableCenter
            : currentGameData.tileFactory.displays.find(d => d.id === factoryId);
        if (!factory || !factory.tiles.includes(tileType)) {
            showNotification('Ongeldige factory of tegeltype!');
            return;
        }

        try {
            const allTilesInFactory = Array.from(factoryCircle.querySelectorAll('.tile-image'));
            const tilesToTake = allTilesInFactory.filter(tile => parseInt(tile.dataset.tileType) === tileType);
            const tilesToCenter = allTilesInFactory.filter(tile => parseInt(tile.dataset.tileType) !== tileType);

            if (tilesToTake.length === 0) {
                showNotification('Geen tegels van dit type beschikbaar!');
                return;
            }

            tilesToTake.forEach(tile => tile.classList.add('selected'));

            if (tilesToCenter.length > 0 && !fromCenter) {
                const centerCircle = document.querySelector('.center-circle .tile-grid');
                tilesToCenter.forEach(tile => {
                    tile.classList.remove('selected');
                    centerCircle.appendChild(tile);
                });
            }

            selectedTiles = {
                count: tilesToTake.length,
                type: tileType,
                fromCenter: fromCenter,
                factoryId: factoryId,
                includesStarterTile: fromCenter && allTilesInFactory.some(tile => parseInt(tile.dataset.tileType) === 0)
            };

            if (selectedTiles.includesStarterTile && fromCenter) {
                firstPlayerNextRound = currentPlayerId;
                console.log(`Player ${currentPlayerId} took starting tile, will start next round`);
            }

            console.log('Take Tiles Request:', {
                gameId,
                displayId: factoryId,
                tileType,
                token: token.substring(0, 10) + '...'
            });

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

            if (allTilesInFactory.length === tilesToCenter.length + tilesToTake.length) {
                factoryCircle.querySelector('.tile-grid').innerHTML = '';
            }

            showTilesToMove(tilesToTake, tileType, fromCenter);

        } catch (err) {
            console.error('Fout bij take-tiles:', err);
            showNotification(err.message || 'Fout bij uitvoeren zet');
            resetSelection();
        }
    });
}

function getPatternLineStatus(patternLines, rowIndex, tileType, wall) {
    const apiLine = patternLines[rowIndex] || { length: rowIndex + 1, tileType: null, numberOfTiles: 0, isComplete: false };
    const tilesArray = Array(rowIndex + 1).fill(null);
    for (let i = 0; i < apiLine.numberOfTiles && i < tilesArray.length; i++) {
        tilesArray[tilesArray.length - 1 - i] = apiLine.tileType; // Fill from right to left
    }
    const lineLength = rowIndex + 1;
    const currentTiles = tilesArray.filter(t => t !== null).length;
    const availableSlots = lineLength - currentTiles;
    const existingTileType = tilesArray.find(t => t !== null);

    // Check if the wall already has a tile of this type in the corresponding row
    const wallHasTile = wall[rowIndex].some(tile => tile !== null && tile === tileType);

    const canSelect = availableSlots > 0 && (!existingTileType || existingTileType === tileType) && !wallHasTile;

    return {
        canSelect,
        availableSlots,
        reason: canSelect ? `${availableSlots} slot(s) available` : wallHasTile ? 'Wall already has this tile type' : existingTileType ? 'Tile type mismatch' : 'Row is full'
    };
}

function showTilesToMove(tiles, tileType, fromCenter) {
    const moveContainer = document.createElement('div');
    moveContainer.className = 'tiles-to-move-container';

    const selfPlayer = currentGameData?.players?.find(p => p.id === currentPlayerId);
    if (!selfPlayer || !selfPlayer.board) {
        console.error('Self player or board not found:', { selfPlayer, currentGameData });
        showNotification('Error: Player board data missing');
        resetSelection();
        return;
    }

    const patternLines = selfPlayer.board.patternLines || Array(5).fill().map((_, i) => ({ length: i + 1, tileType: null, numberOfTiles: 0, isComplete: false }));
    const wall = selfPlayer.board.wall ? Array(5).fill().map((_, row) => Array(5).fill(null).map((_, col) => selfPlayer.board.wall[row * 5 + col] || null)) : Array(5).fill().map(() => Array(5).fill(null));

    const validRows = Array.from({ length: 5 }, (_, i) => i).map(rowIndex => {
        const status = getPatternLineStatus(patternLines, rowIndex, tileType, wall);
        return status.canSelect ? { index: rowIndex, availableSlots: status.availableSlots } : null;
    }).filter(row => row !== null);

    let tilesToPlace = tiles.length;

    moveContainer.innerHTML = `
        <div class="tiles-preview">
            ${Array.from({ length: tiles.length }, () =>
        `<img src="${tileTypeToImage.getImage(tileType)}" class="tile-image" alt="Tile ${tileType}">`
    ).join('')}
            ${fromCenter && selectedTiles.includesStarterTile ? `<img src="${tileTypeToImage.getImage(0)}" class="tile-image" alt="Starter Tile">` : ''}
        </div>
        <div class="row-options">
            ${validRows.length > 0 ? validRows.map(row => {
        const excessTiles = tilesToPlace > row.availableSlots ? tilesToPlace - row.availableSlots : 0;
        return `
                    <button class="row-option" data-row="${row.index}">
                        Plaats in Rij ${row.index + 1} (${row.availableSlots} slot(s) beschikbaar)
                        ${excessTiles > 0 ? `<br>(${excessTiles} tegel(s) naar penalty line)` : ''}
                        ${selectedTiles.includesStarterTile ? `<br>(Starter tile naar penalty line)` : ''}
                    </button>
                `;
    }).join('') : '<p>Geen geldige rijen beschikbaar.</p>'}
            <button class="row-option" data-row="-1">Plaats in Penalty Line</button>
        </div>
    `;

    document.body.appendChild(moveContainer);
}

function setupSelectionEventListeners() {
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('row-option')) {
            const rowIndex = parseInt(e.target.dataset.row);
            await placeTilesOnPatternLine(rowIndex);
        }
    });
}

async function placeTilesOnPatternLine(rowIndex) {
    const token = sessionStorage.getItem('token');
    const gameId = document.getElementById('gameIdValue').textContent;
    const selfPlayer = currentGameData?.players?.find(p => p.id === currentPlayerId);

    if (!selfPlayer || !selfPlayer.board) {
        showNotification('Error: Player board data missing');
        resetSelection();
        return;
    }

    stopPolling();

    try {
        const tileType = selectedTiles.type;
        let tilesToPlace = selectedTiles.count;
        let tilesPlaced = 0;
        let penaltyLine = selfPlayer.board.floorLine?.map(f => f.hasTile ? f.type : null) || Array(7).fill(null);

        // Handle starter tile
        if (selectedTiles.includesStarterTile) {
            let placed = false;
            for (let i = 0; i < penaltyLine.length && !placed; i++) {
                if (penaltyLine[i] === null) {
                    penaltyLine[i] = 0; // Starter tile
                    placed = true;
                }
            }
            if (!placed) {
                console.warn('Penalty line full, starter tile discarded');
            }
            tilesToPlace -= 1; // Starter tile doesn't count for pattern line
        }

        let tilesArray = [];
        let currentTiles = 0;
        let availableSlots = 0;

        if (rowIndex >= 0) {
            const patternLine = selfPlayer.board.patternLines[rowIndex] || { length: rowIndex + 1, tileType: null, numberOfTiles: 0, isComplete: false };
            tilesArray = Array(rowIndex + 1).fill(null);
            for (let i = 0; i < patternLine.numberOfTiles && i < tilesArray.length; i++) {
                tilesArray[tilesArray.length - 1 - i] = patternLine.tileType;
            }
            currentTiles = tilesArray.filter(t => t !== null).length;
            availableSlots = rowIndex + 1 - currentTiles;

            const existingTileType = tilesArray.find(t => t !== null);
            if (existingTileType && existingTileType !== tileType) {
                showNotification('Kan tegels niet plaatsen: Tile type mismatch in pattern line');
                resetSelection();
                startPolling(gameId, token);
                return;
            }

            // Place tiles in pattern line (right to left)
            for (let i = tilesArray.length - 1; i >= 0 && tilesPlaced < Math.min(tilesToPlace, availableSlots); i--) {
                if (tilesArray[i] === null) {
                    tilesArray[i] = tileType;
                    tilesPlaced++;
                }
            }
            console.log(`Tiles placed in row ${rowIndex}:`, tilesArray);
        }

        // Handle excess tiles
        let excessTiles = tilesToPlace - tilesPlaced;
        if (excessTiles > 0 || rowIndex < 0) {
            const tilesToPenalty = rowIndex < 0 ? tilesToPlace : excessTiles;
            let remainingPenalty = tilesToPenalty;
            for (let i = 0; i < penaltyLine.length && remainingPenalty > 0; i++) {
                if (penaltyLine[i] === null) {
                    penaltyLine[i] = tileType;
                    remainingPenalty--;
                }
            }
            if (remainingPenalty > 0) {
                console.warn('Penalty line full, excess tiles discarded:', remainingPenalty);
            }
        }

        // Calculate penalties
        const penaltyValues = [-1, -1, -2, -2, -2, -3, -3];
        const penalties = penaltyLine.reduce((acc, tile, idx) => {
            if (tile !== null) {
                return acc + penaltyValues[idx];
            }
            return acc;
        }, 0);

        // Update local game state
        const updatedPlayers = currentGameData.players.map(p => {
            if (p.id === currentPlayerId) {
                const updatedPatternLines = [...(p.board.patternLines || Array(5).fill().map((_, i) => ({ length: i + 1, tileType: null, numberOfTiles: 0, isComplete: false })))];
                if (rowIndex >= 0) {
                    updatedPatternLines[rowIndex] = {
                        length: rowIndex + 1,
                        tileType: tilesPlaced > 0 ? tileType : updatedPatternLines[rowIndex]?.tileType,
                        numberOfTiles: currentTiles + tilesPlaced,
                        isComplete: (currentTiles + tilesPlaced) === (rowIndex + 1)
                    };
                }

                return {
                    ...p,
                    board: {
                        ...p.board,
                        patternLines: updatedPatternLines,
                        floorLine: penaltyLine.map(type => ({ hasTile: type !== null, type })),
                        penalties
                    }
                };
            }
            return p;
        });

        currentGameData = {
            ...currentGameData,
            players: updatedPlayers
        };

        // Update UI
        if (rowIndex >= 0) {
            updatePatternLineUI(selfPlayer.id, rowIndex, tilesArray);
        }
        updatePenaltyLineUI(selfPlayer.id, penaltyLine);
        document.querySelector(`#penalty-line-${selfPlayer.id} + .penalties`).textContent = `Penalties: ${penalties}`;

        // Backend call
        const endpoint = rowIndex >= 0 ? `place-tiles-on-patternline` : `place-tiles-on-floorline`;
        const body = rowIndex >= 0 ? { patternLineIndex: rowIndex } : {};

        const response = await fetch(`https://localhost:5051/api/Games/${gameId}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || `Fout bij plaatsen tegels op ${rowIndex >= 0 ? 'pattern line' : 'floor line'}`);
        }

        // Fetch updated game state
        const updatedGameData = await fetchGameData(gameId, token);
        currentGameData = updatedGameData;

        renderBoardsAndFactory(currentGameData);
        showNotification(rowIndex >= 0 ? `Tegels geplaatst in rij ${rowIndex + 1}!` : 'Tegels naar penalty line gegaan!');

        if (isRoundOver(currentGameData)) {
            await handleEndOfRound(gameId, token);
        }

    } catch (err) {
        console.error('Fout bij plaatsen tegels:', err);
        showNotification(err.message || 'Fout bij plaatsen tegels');
        const updatedGameData = await fetchGameData(gameId, token);
        currentGameData = updatedGameData;
        renderBoardsAndFactory(currentGameData);
    } finally {
        resetSelection();
        startPolling(gameId, token);
    }
}

function isRoundOver(gameData) {
    const factories = gameData.tileFactory?.displays || [];
    const tableCenter = gameData.tileFactory?.tableCenter || { tiles: [] };
    const allFactoriesEmpty = factories.every(factory => factory.tiles.length === 0);
    const tableCenterEmpty = tableCenter.tiles.length === 0;
    return allFactoriesEmpty && tableCenterEmpty;
}

async function handleEndOfRound(gameId, token) {
    try {
        console.log('Starting handleEndOfRound for gameId:', gameId);

        // Stop polling om conflicten te voorkomen
        stopPolling();

        // Notificeer de speler dat de ronde is afgelopen
        showNotification('Ronde geëindigd! Wacht op serverupdate...');

        // Haal de bijgewerkte game state op van de server
        const updatedGameData = await fetchGameData(gameId, token);
        console.log('New game data from server after round end:', JSON.stringify(updatedGameData, null, 2));

        // Werk de lokale game state bij
        currentGameData = updatedGameData;

        // Werk de UI bij
        renderBoardsAndFactory(currentGameData);
        renderScores(currentGameData.players);
        updateActivePlayerDisplay(currentGameData);

        // Controleer of het spel is afgelopen
        if (currentGameData.hasEnded) {
            showNotification('Spel geëindigd! Een speler heeft een horizontale rij voltooid.');
            await displayFinalScores(gameId, token);
            return;
        }

        // Stel de eerste speler voor de volgende ronde in (indien nodig)
        if (firstPlayerNextRound) {
            console.log(`Setting next round's first player to ${firstPlayerNextRound}`);
            firstPlayerNextRound = null;
        }

        showNotification('Nieuwe ronde gestart!');

        // Start polling opnieuw
        startPolling(gameId, token);
    } catch (err) {
        console.error('Fout in handleEndOfRound:', err);
        showNotification('Fout bij verwerken einde ronde: ' + err.message);
        const updatedGameData = await fetchGameData(gameId, token);
        currentGameData = updatedGameData;
        renderBoardsAndFactory(currentGameData);
        startPolling(gameId, token);
    }
}


function getWallPosition(rowIndex, tileType) {
    const colIndex = wallPatterns[rowIndex].indexOf(tileType);
    console.log(`getWallPosition: row=${rowIndex}, tileType=${tileType}, colIndex=${colIndex}`);
    return colIndex;
}

function calculateScore(wall, row, col) {
    let score = 1; // Base point for placing the tile

    let hCount = 1;
    for (let c = col - 1; c >= 0 && wall[row][c] !== null; c--) hCount++;
    for (let c = col + 1; c < 5 && wall[row][c] !== null; c++) hCount++;
    if (hCount > 1) score += hCount - 1;

    let vCount = 1;
    for (let r = row - 1; r >= 0 && wall[r][col] !== null; r--) vCount++;
    for (let r = row + 1; r < 5 && wall[r][col] !== null; r++) vCount++;
    if (vCount > 1) score += vCount - 1;

    console.log(`calculateScore: row=${row}, col=${col}, hCount=${hCount}, vCount=${vCount}, total=${score}`);
    return score;
}

async function displayFinalScores(gameId, token) {
    try {
        const gameData = await fetchGameData(gameId, token);
        const players = gameData.players;

        const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
        const winner = sortedPlayers[0];

        const finalScores = sortedPlayers.map(player => `${player.name}: ${player.score || 0}`).join('\n');
        const message = `Spel geëindigd!\nWinnaar: ${winner.name} met ${winner.score || 0} punten\n\nScores:\n${finalScores}`;

        showNotification(message, 10000); // Show for 10 seconds
    } catch (err) {
        console.error('Fout bij tonen eindscores:', err);
        showNotification('Fout bij tonen eindscores');
    }
}

function updatePatternLineUI(playerId, rowIndex, tilesArray) {
    const patternRow = document.querySelector(`.board .pattern-row[data-row-index="${rowIndex}"]`);
    if (!patternRow) return;

    patternRow.innerHTML = tilesArray.map((tile, i) => {
        if (tile !== null) {
            return `<img src="${tileTypeToImage.getImage(tile)}" class="tile-image pattern-tile" data-tile-type="${tile}" data-row="${rowIndex}" data-pos="${i}">`;
        }
        return `<div class="tile pattern-tile" data-row="${rowIndex}" data-pos="${i}"></div>`;
    }).join('');
}

function updatePenaltyLineUI(playerId, penaltyLine) {
    const penaltyLineContainer = document.getElementById(`penalty-line-${playerId}`);
    if (!penaltyLineContainer) return;

    penaltyLineContainer.innerHTML = penaltyLine.map((tile, i) =>
        tile !== null
            ? `<img src="${tileTypeToImage.getImage(tile)}" class="tile-image penalty-tile" data-tile-type="${tile}" data-pos="${i}">`
            : `<div class="penalty-tile" data-pos="${i}"></div>`
    ).join('');
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
    try {
        const res = await fetch(`https://localhost:5051/api/Tables/${tableId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Fout bij ophalen tableData');
        }
        return await res.json();
    } catch (err) {
        console.error('fetchTableData error:', err);
        throw err;
    }
}

async function fetchGameData(gameId, token) {
    try {
        const res = await fetch(`https://localhost:5051/api/Games/${gameId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Fout bij ophalen gameData');
        }
        return await res.json();
    } catch (err) {
        console.error('fetchGameData error:', err);
        throw err;
    }
}

function renderScores(players) {
    const scorePanel = document.getElementById('scorePanel');
    if (!scorePanel) {
        console.error('scorePanel element niet gevonden');
        showNotification('Fout: Scorepaneel niet gevonden');
        return;
    }
    scorePanel.innerHTML = '';

    if (!players || !Array.isArray(players)) {
        console.error('Ongeldige spelersdata voor scores:', players);
        showNotification('Fout: Geen spelersdata voor scores');
        return;
    }

    players.forEach(player => {
        const playerScore = document.createElement('div');
        playerScore.textContent = `${player.name}: ${player.score ?? 0}`;
        scorePanel.appendChild(playerScore);
    });
}

function updateActivePlayerDisplay(gameData) {
    const activePlayer = gameData.players.find(p => p.id === gameData.playerToPlayId);
    console.log('Updating active player:', {
        playerToPlayId: gameData.playerToPlayId,
        activePlayer: activePlayer,
        players: gameData.players.map(p => ({ id: p.id, name: p.name }))
    });
    const activePlayerDisplay = document.getElementById('activePlayer');
    if (activePlayerDisplay) {
        activePlayerDisplay.textContent = `Aan de beurt: ${activePlayer?.name || 'Onbekend'}`;
        if (currentPlayerId === gameData.playerToPlayId) {
            activePlayerDisplay.classList.add('your-turn');
            activePlayerDisplay.classList.remove('not-your-turn');
        } else {
            activePlayerDisplay.classList.add('not-your-turn');
            activePlayerDisplay.classList.remove('your-turn');
        }
    }
}

function showNotification(message, duration = 3000) {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) existingNotification.remove();

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, duration);
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