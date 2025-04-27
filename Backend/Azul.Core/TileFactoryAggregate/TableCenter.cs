using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.TileFactoryAggregate;

internal class TableCenter : ITableCenter
{
    public Guid Id => throw new NotImplementedException();

    public IReadOnlyList<TileType> Tiles => throw new NotImplementedException();

    public bool IsEmpty => throw new NotImplementedException();

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