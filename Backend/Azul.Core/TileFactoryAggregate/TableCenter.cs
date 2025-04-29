using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.TileFactoryAggregate;

internal class TableCenter : ITableCenter
{
    public Guid Id => throw new NotImplementedException();

    private readonly List<TileType> _tiles = new();

    public IReadOnlyList<TileType> Tiles => _tiles.AsReadOnly();

    public bool IsEmpty => !_tiles.Any();

    public void AddStartingTile()
    {
        throw new NotImplementedException();
    }

    public void AddTiles(IReadOnlyList<TileType> tilesToAdd)
    {
        throw new NotImplementedException();
    }

    public IReadOnlyList<TileType> TakeTiles(TileType tileType)
    {
        throw new NotImplementedException();
    }
}