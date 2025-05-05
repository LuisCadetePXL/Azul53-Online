using Azul.Core.TileFactoryAggregate.Contracts;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;

namespace Azul.Core.TileFactoryAggregate;

internal class FactoryDisplay : IFactoryDisplay
{
    private readonly ITableCenter _tableCenter;
    private readonly List<TileType> _tiles = new List<TileType>();

    public FactoryDisplay(ITableCenter tableCenter)
    {
        _tableCenter = tableCenter;
    }

    public Guid Id { get; } = Guid.NewGuid();

    public IReadOnlyList<TileType> Tiles => _tiles.AsReadOnly();

    public bool IsEmpty => !_tiles.Any();

    public void AddTiles(IReadOnlyList<TileType> tilesToAdd)
    {
        _tiles.AddRange(tilesToAdd);
    }

    public IReadOnlyList<TileType> TakeTiles(TileType tileType)
    {
        List<TileType> takenTiles = _tiles.Where(tile => tile == tileType).ToList();
        List<TileType> remainingTiles = _tiles.Where(tile => tile != tileType).ToList();

        _tiles.Clear();
        _tableCenter.AddTiles(remainingTiles);

        return takenTiles.AsReadOnly();
    }
}
