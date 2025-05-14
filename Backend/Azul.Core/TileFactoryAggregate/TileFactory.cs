using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.TileFactoryAggregate;

internal class TileFactory : ITileFactory
{
    private readonly int _numberOfDisplays;
    private readonly ITileBag _bag;
    private readonly List<IFactoryDisplay> _displays;
    private readonly ITableCenter _tableCenter;
    private readonly List<TileType> _usedTiles;

    internal TileFactory(int numberOfDisplays, ITileBag bag)
    {
        _bag = bag;
        _numberOfDisplays = numberOfDisplays;
        _tableCenter = new TableCenter();
        _usedTiles = new List<TileType>();

        _displays = new List<IFactoryDisplay>();
        for (int i = 0; i < numberOfDisplays; i++)
        {
            _displays.Add(new FactoryDisplay(_tableCenter));
        }
    }

    public ITileBag Bag => _bag;

    public IReadOnlyList<IFactoryDisplay> Displays => _displays.AsReadOnly();

    public ITableCenter TableCenter => _tableCenter;

    public IReadOnlyList<TileType> UsedTiles => _usedTiles.AsReadOnly();

    public bool IsEmpty => _displays.All(d => d.IsEmpty) && _tableCenter.IsEmpty;


    public void AddToUsedTiles(TileType tile)
    {
        _usedTiles.Add(tile);
    }

    public void FillDisplays()
    {
        foreach (IFactoryDisplay display in _displays)
        {
            if (!_bag.TryTakeTiles(4, out IReadOnlyList<TileType> takenTiles) || takenTiles.Count < 4)
            {
                if (_usedTiles.Count > 0)
                {
                    _bag.AddTiles(_usedTiles);
                    _usedTiles.Clear();

                    _bag.TryTakeTiles(4 - takenTiles.Count, out var additionalTiles);
                    takenTiles = takenTiles.Concat(additionalTiles).ToList();
                }
            }

            if (takenTiles.Count > 0)
            {
                display.AddTiles(takenTiles);
            }
        }
    }

    public IReadOnlyList<TileType> TakeTiles(Guid displayId, TileType tileType)
    {
        IFactoryDisplay display = _displays.FirstOrDefault(d => d.Id == displayId);
        if (display != null)
        {
            if (!display.Tiles.Contains(tileType))
            {
                throw new InvalidOperationException("Tile does not exist on display.");
            }
            return display.TakeTiles(tileType);
        }

        if (displayId == _tableCenter.Id)
        {
            if (!_tableCenter.Tiles.Contains(tileType))
            {
                throw new InvalidOperationException("Tile does not exist in the table center.");
            }
            return _tableCenter.TakeTiles(tileType);
        }

        throw new InvalidOperationException("Display does not exist.");
    }
}