using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.TileFactoryAggregate;

/// <inheritdoc cref="ITileBag"/>
internal class TileBag : ITileBag
{
    private readonly List<TileType> _tiles;
    public IReadOnlyList<TileType> Tiles => _tiles;
    public TileBag()
    {
        _tiles = new List<TileType>();
    }

    public void AddTiles(int amount, TileType tileType)
    {
        for (int i = 0; i < amount; i++)
        {
            _tiles.Add(tileType);
        }
    }

    public void AddTiles(IReadOnlyList<TileType> tilesToAdd)
    {
        _tiles.AddRange(tilesToAdd);
    }

    public bool TryTakeTiles(int amount, out IReadOnlyList<TileType> tiles)
    {
        if (_tiles.Count < amount)
        {
            tiles = _tiles.ToList().AsReadOnly();
            _tiles.Clear();
            return false;
        }
        else
        {
            var random = new Random();
            tiles = _tiles.OrderBy(x => random.Next()).Take(amount).ToList().AsReadOnly();

            foreach (var tile in tiles)
            {
                _tiles.Remove(tile);
            }
            return true;
        }
    }
}