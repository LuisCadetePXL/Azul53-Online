using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.TileFactoryAggregate;

internal class FactoryDisplay : IFactoryDisplay
{
    private readonly ITableCenter _tableCenter;
    private readonly List<TileType> _tiles;
    public FactoryDisplay(ITableCenter tableCenter)
    {
        _tableCenter = tableCenter ?? throw new ArgumentNullException(nameof(tableCenter));
        _tiles = new List<TileType>();
        //FYI: The table center is injected to be able to move tiles (that were not taken by a player) to the center
    }

    public Guid Id { get; } = Guid.NewGuid();

    public IReadOnlyList<TileType> Tiles => _tiles.AsReadOnly();

    public bool IsEmpty => _tiles.Count == 0;

    public void AddTiles(IReadOnlyList<TileType> tilesToAdd)
    {
        if (tilesToAdd == null) throw new ArgumentNullException(nameof(tilesToAdd));

        _tiles.AddRange(tilesToAdd);
    }

    public IReadOnlyList<TileType> TakeTiles(TileType tileType)
    {
        var takenTiles = _tiles.FindAll(t => t == tileType);
        _tiles.RemoveAll(t => t == tileType);

        return takenTiles.AsReadOnly();
    }
}