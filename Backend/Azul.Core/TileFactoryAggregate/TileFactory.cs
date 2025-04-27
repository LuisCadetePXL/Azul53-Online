using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.TileFactoryAggregate;

internal class TileFactory : ITileFactory
{
    internal TileFactory(int numberOfDisplays, ITileBag bag)
    {
       
    }

    public ITileBag Bag => throw new NotImplementedException();

    public IReadOnlyList<IFactoryDisplay> Displays => throw new NotImplementedException();

    public ITableCenter TableCenter => throw new NotImplementedException();

    public IReadOnlyList<TileType> UsedTiles => throw new NotImplementedException();

    public bool IsEmpty => throw new NotImplementedException();

    public void AddToUsedTiles(TileType tile)
    {
        throw new NotImplementedException();
    }

    public void FillDisplays()
    {
        throw new NotImplementedException();
    }

    public IReadOnlyList<TileType> TakeTiles(Guid displayId, TileType tileType)
    {
        throw new NotImplementedException();
    }
}