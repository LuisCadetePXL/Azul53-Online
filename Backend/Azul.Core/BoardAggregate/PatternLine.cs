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
        remainingNumberOfTiles = _length - _numberOfTiles;
        if (remainingNumberOfTiles > 0)
        {
            _tileType = type;
            _numberOfTiles += numberOfTilesToAdd;
            remainingNumberOfTiles = _length - _numberOfTiles;
        }
    }
}