using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.TileFactoryAggregate;

internal class FactoryDisplay : IFactoryDisplay
{
    public FactoryDisplay(ITableCenter tableCenter)
    {
        //FYI: The table center is injected to be able to move tiles (that were not taken by a player) to the center
    }

    public Guid Id => throw new NotImplementedException();

    public IReadOnlyList<TileType> Tiles => throw new NotImplementedException();

    public bool IsEmpty => throw new NotImplementedException();

    public void AddTiles(IReadOnlyList<TileType> tilesToAdd)
    {
        throw new NotImplementedException();
    }

    public IReadOnlyList<TileType> TakeTiles(TileType tileType)
    {
        throw new NotImplementedException();
    }
}