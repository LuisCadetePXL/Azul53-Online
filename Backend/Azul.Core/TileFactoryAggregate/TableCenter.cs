using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.TileFactoryAggregate;

internal class TableCenter : ITableCenter
{

    private readonly List<TileType> _tiles = new List<TileType>();

    public Guid Id { get; } = Guid.NewGuid();

    public IReadOnlyList<TileType> Tiles => _tiles.AsReadOnly();

    public bool IsEmpty => !_tiles.Any();


    public void AddStartingTile()
    {
        _tiles.Add(TileType.StartingTile);
    }

    public void AddTiles(IReadOnlyList<TileType> tilesToAdd)
    {
        _tiles.AddRange(tilesToAdd);
    }

    public IReadOnlyList<TileType> TakeTiles(TileType tileType)
    {
        List<TileType> takenTiles = new List<TileType>();


        List<TileType> tilesOfType = _tiles.Where(tile => tile == tileType).ToList();
        takenTiles.AddRange(tilesOfType);

        _tiles.RemoveAll(tile => tile == tileType);

        if (_tiles.Contains(TileType.StartingTile) && !takenTiles.Contains(TileType.StartingTile))
        {
            takenTiles.Add(TileType.StartingTile);
            _tiles.Remove(TileType.StartingTile);
        }

        return takenTiles.AsReadOnly();
    }
}