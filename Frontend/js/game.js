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
let localWallStates = new Map(); // Fallback for wall state if backend fails
let localScores = new Map(); 

// Azul wall pattern
const wallPatterns = [
    [15, 11, 12, 13, 14],
    [14, 15, 11, 12, 13],
    [13, 14, 15, 11, 12],
    [12, 13, 14, 15, 11],
    [11, 12, 13, 14, 15]
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
            updateActivePlayerDisplay(gameData);

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
            await loadAndRenderGame(gameId, token);
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
        board.dataset.playerId = player.id;
        if (player.id === gameData.playerToPlayId) {
            board.classList.add('current-player');
        }

        const patternLines = Array(5).fill().map((_, rowIndex) => {
            const apiLine = player.board?.patternLines?.[rowIndex] || { length: rowIndex + 1, tileType: null, numberOfTiles: 0, isComplete: false };
            const tiles = Array(rowIndex + 1).fill(null);
            for (let i = 0; i < apiLine.numberOfTiles && i < tiles.length; i++) {
                tiles[tiles.length - 1 - i] = apiLine.tileType;
            }
            return { tiles };
        });

        // Parse wall data from backend (5x5 array of { hasTile, type })
        let wall = Array(5).fill().map(() => Array(5).fill(null));
        if (player.board?.wall && Array.isArray(player.board.wall) && player.board.wall.length === 5 && player.board.wall.every(row => Array.isArray(row) && row.length === 5)) {
            wall = player.board.wall.map(row => row.map(cell => cell.hasTile ? Number(cell.type) : null));
            localWallStates.set(player.id, wall); // Sync local state with backend
        } else {
            console.warn(`Invalid or missing wall data for player ${player.id}, using local state:`, player.board?.wall);
            wall = localWallStates.get(player.id) || wall;
            localWallStates.set(player.id, wall); // Ensure local state exists
        }

        const penaltyLine = player.board?.floorLine?.map(f => f.hasTile ? f.type : null) || Array(7).fill(null);
        const penalties = player.board?.floorLine?.filter(p => p.hasTile).length || 0;

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
                    if (tile !== expectedTileType) {
                        console.warn(`Wall tile mismatch at [${rowIdx}][${colIdx}] for player ${player.id}: expected ${expectedTileType}, got ${tile}`);
                    }
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
        const tileType = parseInt(tileImg.dataset.tileType);

        // Prevent selection of the starter tile (tileType 0)
        if (tileType === 0) {
            showNotification('De starttegel kan niet worden geselecteerd!');
            return;
        }

        const factoryCircle = tileImg.closest('.circle');

        if (!factoryCircle) return;

        if (currentPlayerId !== currentGameData?.playerToPlayId) {
            showNotification('Het is niet jouw beurt!');
            return;
        }

        const token = sessionStorage.getItem('token');
        const gameId = document.getElementById('gameIdValue').textContent;
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
            }

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
        tilesArray[tilesArray.length - 1 - i] = apiLine.tileType;
    }
    const lineLength = rowIndex + 1;
    const currentTiles = tilesArray.filter(t => t !== null).length;
    const availableSlots = lineLength - currentTiles;
    const existingTileType = tilesArray.find(t => t !== null);

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
    const wall = localWallStates.get(selfPlayer.id) || Array(5).fill().map(() => Array(5).fill(null));

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
            ${validRows.map(row => {
        const excessTiles = tilesToPlace > row.availableSlots ? tilesToPlace - row.availableSlots : 0;
        return `
                    <button class="row-option" data-row="${row.index}">
                        Plaats in Rij ${row.index + 1} (${row.availableSlots} slot(s) beschikbaar)
                        ${excessTiles > 0 ? `<br>(${excessTiles} tegel(s) naar penalty line)` : ''}
                        ${selectedTiles.includesStarterTile ? `<br>(Starter tile naar penalty line)` : ''}
                    </button>
                `;
    }).join('')}
            <button class="row-option" data-row="-1">Cancel</button>
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

        if (selectedTiles.includesStarterTile) {
            let placed = false;
            for (let i = 0; i < penaltyLine.length && !placed; i++) {
                if (penaltyLine[i] === null) {
                    penaltyLine[i] = 0;
                    placed = true;
                }
            }
            if (!placed) {
                console.warn('Penalty line full, starter tile discarded');
            }
            tilesToPlace -= 1;
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

            for (let i = tilesArray.length - 1; i >= 0 && tilesPlaced < Math.min(tilesToPlace, availableSlots); i--) {
                if (tilesArray[i] === null) {
                    tilesArray[i] = tileType;
                    tilesPlaced++;
                }
            }
        }

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

        const penaltyValues = [-1, -1, -2, -2, -2, -3, -3];
        const penalties = penaltyLine.reduce((acc, tile, idx) => {
            if (tile !== null) {
                return acc + penaltyValues[idx];
            }
            return acc;
        }, 0);

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

        if (rowIndex >= 0) {
            updatePatternLineUI(selfPlayer.id, rowIndex, tilesArray);
        }
        updatePenaltyLineUI(selfPlayer.id, penaltyLine);
        document.querySelector(`#penalty-line-${selfPlayer.id} + .penalties`).textContent = `Penalties: ${penalties}`;

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

        const updatedGameData = await fetchGameData(gameId, token);
        currentGameData = updatedGameData;

        renderBoardsAndFactory(currentGameData);
        renderScores(currentGameData.players);
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
        renderScores(currentGameData.players);
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

        stopPolling();

        showNotification('Ronde geëindigd! Muurbekleding gestart...');

        // Notify backend to process wall-tiling phase
        const response = await fetch(`https://localhost:5051/api/Games/${gameId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Fout bij verwerken muurbekleding');
        }

        // Fetch updated game data after wall-tiling
        const backendGameData = await fetchGameData(gameId, token);
        console.log('Updated game data after round:', backendGameData);

        // Update local wall states from backend data
        backendGameData.players.forEach(player => {
            let wall = Array(5).fill().map(() => Array(5).fill(null));
            if (player.board?.wall && Array.isArray(player.board.wall) && player.board.wall.length === 5 && player.board.wall.every(row => Array.isArray(row) && row.length === 5)) {
                wall = player.board.wall.map(row => row.map(cell => cell.hasTile ? Number(cell.type) : null));
                localWallStates.set(player.id, wall);
            } else {
                console.warn(`Invalid wall data for player ${player.id}, retaining local state`);
                wall = localWallStates.get(player.id) || wall;
                localWallStates.set(player.id, wall);
            }
        });

        // Update UI for pattern lines and floor lines based on backend data
        backendGameData.players.forEach(player => {
            const patternLines = player.board.patternLines || [];
            for (let rowIndex = 0; rowIndex < 5; rowIndex++) {
                const line = patternLines[rowIndex] || { numberOfTiles: 0, tileType: null };
                if (!line.numberOfTiles) {
                    updatePatternLineUI(player.id, rowIndex, Array(rowIndex + 1).fill(null));
                } else {
                    const tilesArray = Array(rowIndex + 1).fill(null);
                    for (let i = 0; i < line.numberOfTiles; i++) {
                        tilesArray[tilesArray.length - 1 - i] = line.tileType;
                    }
                    updatePatternLineUI(player.id, rowIndex, tilesArray);
                }
            }
            const floorLine = player.board.floorLine?.map(f => f.hasTile ? f.type : null) || Array(7).fill(null);
            updatePenaltyLineUI(player.id, floorLine);
            const penalties = player.board.floorLine?.filter(f => f.hasTile).length || 0;
            document.querySelector(`#penalty-line-${player.id} + .penalties`).textContent = `Penalties: ${penalties}`;
        });

        currentGameData = {
            ...currentGameData,
            ...backendGameData
        };

        renderBoardsAndFactory(currentGameData);
        renderScores(currentGameData.players);
        updateActivePlayerDisplay(currentGameData);

        if (currentGameData.hasEnded) {
            showNotification('Spel geëindigd! Een speler heeft een horizontale rij voltooid.');
            await displayFinalScores(gameId, token);
            return;
        }

        showNotification('Nieuwe ronde gestart!');
        if (firstPlayerNextRound) {
            console.log(`Setting next round's first player to ${firstPlayerNextRound}`);
            firstPlayerNextRound = null;
        }

        startPolling(gameId, token);
    } catch (err) {
        console.error('Fout in handleEndOfRound:', err);
        showNotification('Fout bij verwerken einde ronde: ' + err.message);
        const updatedGameData = await fetchGameData(gameId, token);
        currentGameData = updatedGameData;
        renderBoardsAndFactory(currentGameData);
        renderScores(currentGameData.players);
        startPolling(gameId, token);
    }
}

async function displayFinalScores(gameId, token) {
    try {
        const gameData = await fetchGameData(gameId, token);
        const players = gameData.players;

        const playerScores = players.map(player => {
            let bonus = 0;
            let horizontalLines = 0;
            let wall = Array(5).fill().map(() => Array(5).fill(null));
            if (player.board?.wall && Array.isArray(player.board.wall) && player.board.wall.length === 5 && player.board.wall.every(row => Array.isArray(row) && row.length === 5)) {
                wall = player.board.wall.map(row => row.map(cell => cell.hasTile ? Number(cell.type) : null));
                localWallStates.set(player.id, wall);
            } else {
                console.warn(`Invalid wall data for player ${player.id} in final scores, using local state`);
                wall = localWallStates.get(player.id) || wall;
            }

            for (let row = 0; row < 5; row++) {
                if (wall[row].every(tile => tile !== null)) {
                    bonus += 2;
                    horizontalLines++;
                }
            }

            for (let col = 0; col < 5; col++) {
                if (wall.every(row => row[col] !== null)) {
                    bonus += 7;
                }
            }

            const tileCounts = {};
            wall.flat().forEach(tile => {
                if (tile !== null) tileCounts[tile] = (tileCounts[tile] || 0) + 1;
            });
            Object.values(tileCounts).forEach(count => {
                if (count === 5) bonus += 10;
            });

            return {
                ...player,
                finalScore: (player.score || 0) + bonus,
                horizontalLines
            };
        });

        const sortedPlayers = [...playerScores].sort((a, b) => b.finalScore - a.finalScore);
        const maxScore = sortedPlayers[0].finalScore;
        const topPlayers = sortedPlayers.filter(p => p.finalScore === maxScore);

        let winners;
        if (topPlayers.length === 1) {
            winners = [topPlayers[0]];
        } else {
            const maxHorizontal = Math.max(...topPlayers.map(p => p.horizontalLines));
            winners = topPlayers.filter(p => p.horizontalLines === maxHorizontal);
        }

        const winnerNames = winners.map(p => p.name).join(' & ');
        const finalScoresText = sortedPlayers.map(p => `${p.name}: ${p.finalScore} (Horizontale lijnen: ${p.horizontalLines})`).join('\n');

        const message = `Spel geëindigd!\nWinnaar${winners.length > 1 ? 's' : ''}: ${winnerNames}\n\nEindscores:\n${finalScoresText}`;

        const modal = document.createElement('div');
        modal.className = 'game-end-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Spel Geëindigd!</h2>
                <p>${message.replace(/\n/g, '<br>')}</p>
                <button id="returnToLobby">Terug naar Lobby</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('returnToLobby').addEventListener('click', () => {
            sessionStorage.removeItem('tableId');
            window.location.href = 'lobby.html';
        });

    } catch (err) {
        console.error('Fout bij tonen eindscores:', err);
        showNotification('Fout bij tonen eindscores');
    }
}

function updatePatternLineUI(playerId, rowIndex, tilesArray) {
    const board = document.querySelector(`.board[data-player-id="${playerId}"]`);
    const patternRow = board?.querySelector(`.pattern-row[data-row-index="${rowIndex}"]`);
    if (!patternRow) {
        console.warn('Pattern row not found for UI update:', { playerId, rowIndex });
        return;
    }

    patternRow.innerHTML = tilesArray.map((tile, i) => {
        if (tile !== null) {
            return `<img src="${tileTypeToImage.getImage(tile)}" class="tile-image pattern-tile" data-tile-type="${tile}" data-row="${rowIndex}" data-pos="${i}">`;
        }
        return `<div class="tile pattern-tile" data-row="${rowIndex}" data-pos="${i}"></div>`;
    }).join('');
}

function updatePenaltyLineUI(playerId, penaltyLine) {
    const penaltyLineContainer = document.getElementById(`penalty-line-${playerId}`);
    if (!penaltyLineContainer) {
        console.warn('Penalty line container not found:', { playerId });
        return;
    }

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
        const gameData = await res.json();
        // Validate wall data format
        gameData.players.forEach(player => {
            if (player.board?.wall && (!Array.isArray(player.board.wall) || player.board.wall.length !== 5 || !player.board.wall.every(row => Array.isArray(row) && row.length === 5))) {
                console.warn(`Unexpected wall format for player ${player.id}:`, player.board.wall);
            }
        });
        return gameData;
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
      
        playerScore.className = 'player-score';
        playerScore.dataset.playerId = player.id;

        const score = (player.board && typeof player.board.score === 'number') ? player.board.score : 0;
        playerScore.textContent = `${player.name}: ${score}`;
      
        scorePanel.appendChild(playerScore);
    });
}

function updateActivePlayerDisplay(gameData) {
    const activePlayer = gameData.players.find(p => p.id === gameData.playerToPlayId);
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