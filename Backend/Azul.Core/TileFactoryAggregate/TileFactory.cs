using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.TileFactoryAggregate;

internal class TileFactory : ITileFactory
{
    private readonly ITileBag _bag;
    private readonly List<IFactoryDisplay> _displays = new List<IFactoryDisplay>();
    private readonly List<TileType> _usedTiles = new List<TileType>();
    private readonly ITableCenter _tableCenter;

    public TileFactory(int numberOfDisplays, ITileBag bag)
    {
        _bag = bag ?? throw new ArgumentNullException(nameof(bag));

        // Create the TableCenter internally, no need to pass it
        _tableCenter = new TableCenter();  // Create a new instance of TableCenter.

        // Initialize the displays as empty displays
        for (int i = 0; i < numberOfDisplays; i++)
        {
            _displays.Add(new FactoryDisplay(_tableCenter));  // Pass TableCenter to each display
        }
    }

    public ITileBag Bag => _bag;

    public IReadOnlyList<IFactoryDisplay> Displays => _displays;

    public ITableCenter TableCenter => _tableCenter;

    public IReadOnlyList<TileType> UsedTiles => _usedTiles.AsReadOnly();

    public bool IsEmpty => !_displays.Any(d => d.Tiles.Any());

    public void AddToUsedTiles(TileType tile)
    {
        _usedTiles.Add(tile);
    }

    public void FillDisplays()
    {
        foreach (var display in _displays)
        {
            if (!_bag.TryTakeTiles(4, out IReadOnlyList<TileType> tilesTaken))
            {
                if (_usedTiles.Count > 0)
                {
                    _bag.AddTiles(_usedTiles);
                    _usedTiles.Clear();

                    if (!_bag.TryTakeTiles(4, out tilesTaken))
                    {
                        throw new InvalidOperationException("Onvoldoende tegels beschikbaar.");
                    }
                }
                else
                {
                    throw new InvalidOperationException("Onvoldoende tegels beschikbaar.");
                }
            }

            display.AddTiles(tilesTaken);
        }
    }





    public IReadOnlyList<TileType> TakeTiles(Guid displayId, TileType tileType)
    {
        var display = _displays.FirstOrDefault(d => d.Id == displayId);
        if (display == null)
            throw new ArgumentException("Display not found", nameof(displayId));

        var takenTiles = display.Tiles.Where(t => t == tileType).ToList();
        foreach (var tile in takenTiles)
        {
            display.TakeTiles(tile);  // Assuming TakeTiles method in FactoryDisplay handles tile removal
        }

        return takenTiles;
    }
}