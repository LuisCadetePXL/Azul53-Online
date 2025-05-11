const tileTypeToImage = {
    0: './images/startingTile.png',
    11: './images/yellowRed.png',
    12: './images/plainRed.png',
    13: './images/blackBlue.png',
    14: './images/whiteTurquoise.png',
    15: './images/plainBlue.png',
    null: '../images/unknown.png'
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
            currentGameData = gameData;

            renderBoardsAndFactory(gameData);
            renderScores(gameData.players);

            if (isRoundOver(gameData)) {
                await handleEndOfRound(gameId, token);
            }

            if (gameData?.hasEnded) {
                stopPolling();
                showNotification('Game has ended!');
            }
        } catch (err) {
            console.error('Polling error:', err);
            showNotification('Error refreshing game state');
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
        currentGameData = gameData;

        const selfPlayer = gameData.players.find(p => p.name === currentUsername);
        currentPlayerId = selfPlayer?.id;

        renderBoardsAndFactory(gameData);
        renderScores(gameData.players);

        if (selfPlayer) {
            document.getElementById('playerName').textContent = `Speler: ${selfPlayer.name}`;
        }

        updateActivePlayerDisplay(gameData);
    } catch (err) {
        console.error('Error loading game:', err);
        throw err;
    }
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

        const patternLines = Array(5).fill().map((_, rowIndex) => {
            const apiLine = player.board?.patternLines?.[rowIndex] || { length: rowIndex + 1, tileType: null, numberOfTiles: 0, isComplete: false };
            const tiles = Array(rowIndex + 1).fill(null);
            for (let i = 0; i < apiLine.numberOfTiles && i < tiles.length; i++) {
                tiles[i] = apiLine.tileType;
            }
            return { tiles };
        });

        let wall = Array(5).fill().map(() => Array(5).fill(null));
        if (player.board?.wall && Array.isArray(player.board.wall)) {
            player.board.wall.forEach((tile, idx) => {
                if (typeof tile !== "string") {
                    const row = Math.floor(idx / 5);
                    const col = idx % 5;
                    if (row < 5 && col < 5) {
                        wall[row][col] = { type: parseInt(tile) || null };
                    }
                }
            });
        }

        const penaltyLine = player.board?.floorLine?.map(f => f.hasTile ? f.type : null) || Array(7).fill(null);
        const penalties = player.board?.penalties || 0;

        const patternRows = patternLines.map((line, rowIndex) => {
            const tilesInRow = rowIndex + 1;
            const tiles = line.tiles || Array(tilesInRow).fill(null);

            return `<div class="pattern-row" data-row-index="${rowIndex}">${tiles.map((tile, i) =>
                tile !== null
                    ? `<img src="${tileTypeToImage[tile] || tileTypeToImage[null]}" class="tile-image pattern-tile" data-tile-type="${tile}" data-row="${rowIndex}" data-pos="${i}">`
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
                    ${wall.map((row, rowIdx) =>
            row.map((cell, colIdx) => {
                if (cell) {
                    const src = tileTypeToImage[cell.type] || tileTypeToImage[null];
                    return `<img src="${src}" class="tile-image board-tile" alt="Tile ${cell.type}" data-row="${rowIdx}" data-col="${colIdx}">`;
                }
                return `<div class="tile empty-tile" data-row="${rowIdx}" data-col="${colIdx}"></div>`;
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
                ? `<img src="${tileTypeToImage[tile] || tileTypeToImage[null]}" class="tile-image penalty-tile" data-tile-type="${tile}" data-pos="${i}">`
                : `<div class="penalty-tile" data-pos="${i}"></div>`
        ).join('')}
                </div>
                <div class="penalties">Penalties: ${penalties}</div>
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
            const src = tileTypeToImage[tile] || tileTypeToImage[null];
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
        const src = tileTypeToImage[tile] || tileTypeToImage[null];
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

function getPatternLineStatus(patternLines, rowIndex, tileType) {
    const apiLine = patternLines[rowIndex] || { length: rowIndex + 1, tileType: null, numberOfTiles: 0, isComplete: false };
    const tilesArray = Array(rowIndex + 1).fill(null);
    for (let i = 0; i < apiLine.numberOfTiles && i < tilesArray.length; i++) {
        tilesArray[i] = apiLine.tileType;
    }
    const lineLength = rowIndex + 1;
    const currentTiles = tilesArray.filter(t => t !== null).length;
    const availableSlots = lineLength - currentTiles;
    const existingTileType = tilesArray.find(t => t !== null);

    const canSelect = availableSlots > 0 && (!existingTileType || existingTileType === tileType);

    return {
        canSelect,
        availableSlots,
        reason: canSelect ? `${availableSlots} slot(s) available` : existingTileType ? 'Tile type mismatch' : 'Row is full'
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
    const wall = selfPlayer.board.wall || Array(5).fill().map(() => Array(5).fill(null));

    const validRows = Array.from({ length: 5 }, (_, i) => i).map(rowIndex => {
        const status = getPatternLineStatus(patternLines, rowIndex, tileType);
        return status.canSelect ? { index: rowIndex, availableSlots: status.availableSlots } : null;
    }).filter(row => row !== null);

    let tilesToPlace = tiles.length;

    moveContainer.innerHTML = `
        <div class="tiles-preview">
            ${Array.from({ length: tiles.length }, () =>
        `<img src="${tileTypeToImage[tileType] || tileTypeToImage[null]}" class="tile-image" alt="Tile ${tileType}">`
    ).join('')}
            ${fromCenter && selectedTiles.includesStarterTile ? `<img src="${tileTypeToImage[0] || tileTypeToImage[null]}" class="tile-image" alt="Starter Tile">` : ''}
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
    }).join('') : '<p>Geen geldige rijen beschikbaar. Tegels gaan naar penalty line.</p>'}
        </div>
    `;

    document.body.appendChild(moveContainer);

    // Als er geen geldige rijen zijn, gaan alle tegels automatisch naar de penalty line
    if (validRows.length === 0) {
        placeTilesOnPatternLine(-1); // Gebruik -1 om aan te geven dat tegels direct naar penalty line gaan
    }
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
        let tilesArray = [];
        let tilesPlaced = 0;
        let currentTiles = 0;
        let tileType = selectedTiles.type;
        let tilesToPlace = selectedTiles.count;
        let lineLength = rowIndex + 1;
        let availableSlots = 0;

        if (rowIndex >= 0) {
            const patternLine = selfPlayer.board.patternLines[rowIndex] || { length: rowIndex + 1, tileType: null, numberOfTiles: 0, isComplete: false };
            tilesArray = Array(rowIndex + 1).fill(null);
            for (let i = 0; i < patternLine.numberOfTiles && i < tilesArray.length; i++) {
                tilesArray[i] = patternLine.tileType;
            }
            lineLength = rowIndex + 1;
            currentTiles = tilesArray.filter(t => t !== null).length;
            availableSlots = lineLength - currentTiles;

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

        let penaltyLine = selfPlayer.board.floorLine?.map(f => f.hasTile ? f.type : null) || Array(7).fill(null);

        if (selectedTiles.includesStarterTile) {
            let placed = false;
            for (let i = 0; i < penaltyLine.length; i++) {
                if (penaltyLine[i] === null) {
                    penaltyLine[i] = 0;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                showNotification('Penalty line is vol, starter tile is weggegooid');
            }
        }

        if (excessTiles > 0) {
            for (let i = 0; i < penaltyLine.length && excessTiles > 0; i++) {
                if (penaltyLine[i] === null) {
                    penaltyLine[i] = tileType;
                    excessTiles--;
                }
            }
        }

        if (excessTiles > 0) {
            showNotification('Penalty line is vol, excess tiles zijn weggegooid');
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

        const tempGameData = {
            ...currentGameData,
            players: updatedPlayers
        };

        if (rowIndex >= 0) {
            updatePatternLineUI(selfPlayer.id, rowIndex, tilesArray);
        }
        updatePenaltyLineUI(selfPlayer.id, penaltyLine);
        document.querySelector(`#penalty-line-${selfPlayer.id} + .penalties`).textContent = `Penalties: ${penalties}`;

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
    const factories = gameData.tileFactory.displays;
    const tableCenter = gameData.tileFactory.tableCenter;
    const allFactoriesEmpty = factories.every(factory => factory.tiles.length === 0);
    const tableCenterEmpty = tableCenter.tiles.length === 0;
    return allFactoriesEmpty && tableCenterEmpty;
}

async function handleEndOfRound(gameId, token) {
    try {
        let updatedGameData = { ...currentGameData };
        const players = updatedGameData.players.map(player => {
            let score = player.score || 0;
            let penalties = player.board.penalties || 0;
            const patternLines = player.board.patternLines || Array(5).fill().map((_, i) => ({ length: i + 1, tileType: null, numberOfTiles: 0, isComplete: false }));
            let wall = Array(5).fill().map(() => Array(5).fill(null));
            if (player.board.wall && Array.isArray(player.board.wall)) {
                player.board.wall.forEach((tile, idx) => {
                    if (typeof tile !== "string") {
                        const row = Math.floor(idx / 5);
                        const col = idx % 5;
                        if (row < 5 && col < 5) {
                            wall[row][col] = { type: parseInt(tile) || null };
                        }
                    }
                });
            }
            let penaltyLine = player.board.floorLine?.map(f => f.hasTile ? f.type : null) || Array(7).fill(null);

            patternLines.forEach((line, rowIndex) => {
                if (line.isComplete) {
                    const tileType = line.tileType;
                    const colIndex = getWallPosition(rowIndex, tileType);
                    if (colIndex !== -1 && !wall[rowIndex][colIndex]) {
                        wall[rowIndex][colIndex] = { type: tileType };
                        score += calculateScore(wall, rowIndex, colIndex);
                    }
                    line.tileType = null;
                    line.numberOfTiles = 0;
                    line.isComplete = false;
                }
            });

            const penaltyValues = [-1, -1, -2, -2, -2, -3, -3];
            penalties = penaltyLine.reduce((acc, tile, idx) => {
                if (tile !== null) {
                    return acc + penaltyValues[idx];
                }
                return acc;
            }, 0);
            score = Math.max(0, score + penalties);

            penaltyLine = Array(7).fill(null);

            return {
                ...player,
                score,
                board: {
                    ...player.board,
                    patternLines,
                    wall,
                    floorLine: penaltyLine.map(type => ({ hasTile: type !== null, type })),
                    penalties: 0
                }
            };
        });

        updatedGameData = {
            ...updatedGameData,
            players
        };

        currentGameData = updatedGameData;
        renderBoardsAndFactory(currentGameData);
        renderScores(currentGameData.players);
        showNotification('Ronde geëindigd! Tegels verplaatst naar wall.');

        const response = await fetch(`https://localhost:5051/api/Games/${gameId}/end-round`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Fout bij einde ronde');
        }

        const newGameData = await fetchGameData(gameId, token);
        currentGameData = newGameData;
        renderBoardsAndFactory(currentGameData);
    } catch (err) {
        console.error('Fout bij afhandeling einde ronde:', err);
        showNotification('Fout bij verwerken einde ronde');
    }
}

function getWallPosition(rowIndex, tileType) {
    const wallPatterns = [
        [15, 11, 12, 13, 14],
        [14, 15, 11, 12, 13],
        [13, 14, 15, 11, 12],
        [12, 13, 14, 15, 11],
        [11, 12, 13, 14, 15]
    ];
    const rowPattern = wallPatterns[rowIndex];
    return rowPattern.indexOf(tileType);
}

function calculateScore(wall, row, col) {
    let score = 0;

    let hCount = 1;
    for (let c = col - 1; c >= 0 && wall[row][c]; c--) hCount++;
    for (let c = col + 1; c < 5 && wall[row][c]; c++) hCount++;
    if (hCount > 0) score += hCount;

    let vCount = 1;
    for (let r = row - 1; r >= 0 && wall[r][col]; r--) vCount++;
    for (let r = row + 1; r < 5 && wall[r][col]; r++) vCount++;
    if (vCount > 0) score += vCount;

    return score === 0 ? 1 : score;
}

function updatePatternLineUI(playerId, rowIndex, tilesArray) {
    const patternRow = document.querySelector(`.board .pattern-row[data-row-index="${rowIndex}"]`);
    if (!patternRow) return;

    patternRow.innerHTML = tilesArray.map((tile, i) => {
        if (tile !== null) {
            return `<img src="${tileTypeToImage[tile] || tileTypeToImage[null]}" class="tile-image pattern-tile" data-tile-type="${tile}" data-row="${rowIndex}" data-pos="${i}">`;
        }
        return `<div class="tile pattern-tile" data-row="${rowIndex}" data-pos="${i}"></div>`;
    }).join('');
}

function updatePenaltyLineUI(playerId, penaltyLine) {
    const penaltyLineContainer = document.getElementById(`penalty-line-${playerId}`);
    if (!penaltyLineContainer) return;

    penaltyLineContainer.innerHTML = penaltyLine.map((tile, i) =>
        tile !== null
            ? `<img src="${tileTypeToImage[tile] || tileTypeToImage[null]}" class="tile-image penalty-tile" data-tile-type="${tile}" data-pos="${i}">`
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