using Azul.Core.GameAggregate.Contracts;
using Azul.Core.PlayerAggregate; 
using Azul.Core.PlayerAggregate.Contracts;
using Azul.Core.TileFactoryAggregate.Contracts;
using System;

namespace Azul.Core.GameAggregate;

/// <inheritdoc cref="IGame"/>
internal class Game : IGame
{


    /// <summary>
    /// Creates a new game and determines the player to play first.
    /// </summary>
    /// <param name="id">The unique identifier of the game</param>
    /// <param name="tileFactory">The tile factory</param>
    /// <param name="players">The players that will play the game</param>
    /// 

    
    public Game(Guid id, ITileFactory tileFactory, IPlayer[] players)
    {
        Id = id;
        TileFactory = tileFactory;
        Players = players;
        HasEnded = false;
        RoundNumber = 1;
        PlayerToPlayId = DetermineFirstPlayer(players); 
    }

    private readonly Random _random = new Random();

    public Guid Id { get; }

    public ITileFactory TileFactory { get; }

    public IPlayer[] Players { get; }

    public Guid PlayerToPlayId { get; }

    public int RoundNumber { get; }

    public bool HasEnded { get; }

    public void PlaceTilesOnFloorLine(Guid playerId)
    {
        throw new NotImplementedException();
    }

    public void PlaceTilesOnPatternLine(Guid playerId, int patternLineIndex)
    {
        throw new NotImplementedException();
    }

    public void TakeTilesFromFactory(Guid playerId, Guid displayId, TileType tileType)
    {
        throw new NotImplementedException();
    }

    private Guid DetermineFirstPlayer(IPlayer[] players)
    {
        if (players == null || players.Length == 0)
        {
            throw new ArgumentException("There must be at least one player to start a game.", nameof(players));
        }

        int firstPlayerIndex = _random.Next(players.Length);

        return players[firstPlayerIndex].Id;
    }
}