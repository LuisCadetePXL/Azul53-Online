using Azul.Core.BoardAggregate.Contracts;
using Azul.Core.GameAggregate.Contracts;
using Azul.Core.PlayerAggregate;
using Azul.Core.PlayerAggregate.Contracts;
using Azul.Core.TileFactoryAggregate.Contracts;
using System;
using System.Linq;

namespace Azul.Core.GameAggregate;

/// <inheritdoc cref="IGame"/>
internal class Game : IGame
{
    private readonly Random _random = new Random();
    private int _currentPlayerIndex = 0;

    public Game(Guid id, ITileFactory tileFactory, IPlayer[] players)
    {
        if (players == null || players.Length != 2)
            throw new ArgumentException("Game requires exactly 2 players.");

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

    public Guid Id { get; }
    public ITileFactory TileFactory { get; }
    public IPlayer[] Players { get; }
    public Guid PlayerToPlayId { get; private set; }
    public int RoundNumber { get; private set; }
    public bool HasEnded { get; private set; }

    public void TakeTilesFromFactory(Guid playerId, Guid displayId, TileType tileType)
    {
        EnsurePlayersTurn(playerId);

        IPlayer player = GetPlayerById(playerId);
        if (player.TilesToPlace.Count > 0)
            throw new InvalidOperationException("Player must place previously taken tiles before taking new ones.");

        var tiles = TileFactory.TakeTiles(displayId, tileType);

        foreach (var tile in tiles)
        {
            if (tile == TileType.StartingTile) { 
            player.HasStartingTile = true;
            player.TilesToPlace.Add(tile); 
            }
            else
            {
                player.TilesToPlace.Add(tile);
            }
        }

    }


    public void PlaceTilesOnPatternLine(Guid playerId, int patternLineIndex)
    {
        EnsurePlayersTurn(playerId);
        EnsurePlayerHasTilesToPlace(playerId);

        IPlayer player = GetPlayerById(playerId);
        IBoard board = player.Board;

        List<TileType> tilesToPlace = player.TilesToPlace;

        board.AddTilesToPatternLine(tilesToPlace, patternLineIndex, TileFactory);

        player.TilesToPlace.Clear();

        AdvanceTurnIfNeeded();
    }

    public void PlaceTilesOnFloorLine(Guid playerId)
    {
        EnsurePlayersTurn(playerId);
        EnsurePlayerHasTilesToPlace(playerId);

        var player = GetPlayerById(playerId);
        var tilesToPlace = player.TilesToPlace.ToList();
        player.TilesToPlace.Clear();

        player.Board.AddTilesToFloorLine(tilesToPlace, TileFactory);

        AdvanceTurnIfNeeded();
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
        if (player.TilesToPlace.Count == 0)
            throw new InvalidOperationException("Player has no tiles to place.");
    }

    private void AdvanceTurnIfNeeded()
    {
        if (TileFactory.IsEmpty)
        {
            // Einde van de ronde
            foreach (var player in Players)
            {
                player.Board.DoWallTiling(TileFactory);
                player.HasStartingTile = false;
            }

            RoundNumber++;

            if (Players.Any(p => p.Board.HasCompletedHorizontalLine))
            {
                foreach (var player in Players)
                    player.Board.CalculateFinalBonusScores();

                HasEnded = true;
                return;
            }

            TileFactory.FillDisplays();
            TileFactory.TableCenter.AddStartingTile();

            PlayerToPlayId = DetermineFirstPlayer(Players);
            _currentPlayerIndex = Array.FindIndex(Players, p => p.Id == PlayerToPlayId);
        }
        else
        {
            // Volgende speler
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
