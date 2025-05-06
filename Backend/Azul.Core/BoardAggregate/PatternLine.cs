using Azul.Core.BoardAggregate.Contracts;
using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.BoardAggregate;

/// <inheritdoc cref="IPatternLine"/>
internal class PatternLine : IPatternLine
{
    private readonly int _length;
    private TileType? _tileType;
    private int _numberOfTiles;

    public PatternLine(int length)
    {
        _length = length;
        _tileType = null;
        _numberOfTiles = 0;
    }

    public int Length => _length;

    public TileType? TileType => _tileType;

    public int NumberOfTiles => _numberOfTiles;

    public bool IsComplete => _numberOfTiles == _length;

    public void Clear()
    {
        _tileType = null;
        _numberOfTiles = 0;
    }

    public void TryAddTiles(TileType type, int numberOfTilesToAdd, out int remainingNumberOfTiles)
    {
        if (IsComplete)
        {
            throw new InvalidOperationException("Cannot add tiles to a complete pattern line.");
        }

        if (_tileType != null && _tileType != type)
        {
            throw new InvalidOperationException("Cannot add tiles of a different type to the pattern line.");
        }

        int availableSpace = _length - _numberOfTiles;
        int tilesToAdd = Math.Min(numberOfTilesToAdd, availableSpace);
        remainingNumberOfTiles = numberOfTilesToAdd - tilesToAdd;

        if (tilesToAdd > 0)
        {
            _tileType = type;
            _numberOfTiles += tilesToAdd;
        }
    }
}