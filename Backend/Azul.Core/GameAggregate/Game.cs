using System;
using System.Collections.Generic;
using System.Linq;
using Azul.Core.BoardAggregate.Contracts;
using Azul.Core.GameAggregate.Contracts;
using Azul.Core.PlayerAggregate.Contracts;
using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.GameAggregate;

/// <inheritdoc cref="IGame"/>
internal class Game : IGame
{
    private readonly Random _random = new Random();
    private int _currentPlayerIndex = 0;

    public Guid Id { get; }
    public ITileFactory TileFactory { get; }
    public IPlayer[] Players { get; }
    public Guid PlayerToPlayId { get; private set; }
    public int RoundNumber { get; private set; }
    public bool HasEnded { get; private set; }

    public Game(Guid id, ITileFactory tileFactory, IPlayer[] players)
    {
        if (id == Guid.Empty)
            throw new ArgumentException("Game ID cannot be empty.", nameof(id));
        if (tileFactory == null)
            throw new ArgumentNullException(nameof(tileFactory));
        if (players == null || !players.Any())
            throw new ArgumentException("At least one player is required.", nameof(players));

        Id = id;
        TileFactory = tileFactory;
        Players = players;
        HasEnded = false;
        RoundNumber = 1;

        TileFactory.FillDisplays();
        TileFactory.TableCenter.AddStartingTile();

        foreach (var player in Players)
            player.HasStartingTile = false;

        PlayerToPlayId = DetermineFirstPlayer(players);
        _currentPlayerIndex = Array.FindIndex(players, p => p.Id == PlayerToPlayId);
    }

    public void TakeTilesFromFactory(Guid playerId, Guid displayId, TileType tileType)
    {
        EnsurePlayersTurn(playerId);

        IPlayer player = GetPlayerById(playerId);
        if (player.TilesToPlace.Any())
            throw new InvalidOperationException("Player must place previously taken tiles before taking new ones.");

        var tiles = TileFactory.TakeTiles(displayId, tileType);
        if (!tiles.Any())
            throw new InvalidOperationException("No tiles taken from factory.");

        player.TilesToPlace.AddRange(tiles);
        if (tiles.Contains(TileType.StartingTile))
            player.HasStartingTile = true;
    }

    public void PlaceTilesOnPatternLine(Guid playerId, int patternLineIndex)
    {
        EnsurePlayersTurn(playerId);
        EnsurePlayerHasTilesToPlace(playerId);

        IPlayer player = GetPlayerById(playerId);
        IBoard board = player.Board;

        // Pass the original TilesToPlace list and clear afterward
        board.AddTilesToPatternLine(player.TilesToPlace, patternLineIndex, TileFactory);
        player.TilesToPlace.Clear();

        AdvanceTurn();
    }

    public void PlaceTilesOnFloorLine(Guid playerId)
    {
        EnsurePlayersTurn(playerId);
        EnsurePlayerHasTilesToPlace(playerId);

        IPlayer player = GetPlayerById(playerId);

        // Pass the original TilesToPlace list and clear afterward
        player.Board.AddTilesToFloorLine(player.TilesToPlace, TileFactory);
        player.TilesToPlace.Clear();

        AdvanceTurn();
    }

    // ==============================
    // === PRIVATE HELPER METHODS ===
    // ==============================

    private IPlayer GetPlayerById(Guid playerId)
    {
        return Players.FirstOrDefault(p => p.Id == playerId)
            ?? throw new ArgumentException("Player not found.", nameof(playerId));
    }

    private void EnsurePlayersTurn(Guid playerId)
    {
        if (playerId != PlayerToPlayId)
            throw new InvalidOperationException("It's not this player's turn.");
    }

    private void EnsurePlayerHasTilesToPlace(Guid playerId)
    {
        var player = GetPlayerById(playerId);
        if (!player.TilesToPlace.Any())
            throw new InvalidOperationException("Player has no tiles to place.");
    }

    private void AdvanceTurn()
    {
        if (TileFactory.IsEmpty)
        {
            // End of round
            foreach (var player in Players)
            {
                player.Board.DoWallTiling(TileFactory);
                player.HasStartingTile = false;
            }

            if (Players.Any(p => p.Board.HasCompletedHorizontalLine))
            {
                foreach (var player in Players)
                    player.Board.CalculateFinalBonusScores();

                HasEnded = true;
                return;
            }

            RoundNumber++;

            TileFactory.FillDisplays();
            TileFactory.TableCenter.AddStartingTile();

            PlayerToPlayId = DetermineFirstPlayer(Players);
            _currentPlayerIndex = Array.FindIndex(Players, p => p.Id == PlayerToPlayId);
        }
        else
        {
            // Advance to next player
            _currentPlayerIndex = (_currentPlayerIndex + 1) % Players.Length;
            PlayerToPlayId = Players[_currentPlayerIndex].Id;
        }
    }

    private Guid DetermineFirstPlayer(IPlayer[] players)
    {
        var a = players[0];
        var b = players[1];

        if (a.LastVisitToPortugal == null && b.LastVisitToPortugal != null)
            return b.Id;
        if (b.LastVisitToPortugal == null && a.LastVisitToPortugal != null)
            return a.Id;
        if (a.LastVisitToPortugal == null && b.LastVisitToPortugal == null)
            return a.Id;

        return a.LastVisitToPortugal > b.LastVisitToPortugal ? a.Id : b.Id;
    }
}