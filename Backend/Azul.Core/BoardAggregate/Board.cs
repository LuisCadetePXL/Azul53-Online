using Azul.Core.BoardAggregate.Contracts;
using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.BoardAggregate;

/// <inheritdoc cref="IBoard"/>
internal class Board : IBoard
{
    public IPatternLine[] PatternLines { get; } = new IPatternLine[5]; // 5 lijnen voor Azul
    public TileSpot[,] Wall { get; } = new TileSpot[5, 5]; // 5x5 muur
    public TileSpot[] FloorLine { get; } = new TileSpot[7]; // Floorline met ruimte voor 7 tegels
    public int Score { get; private set; } = 0;
    public bool HasCompletedHorizontalLine => false;

    public void AddTilesToPatternLine(IReadOnlyList<TileType> tilesToAdd, int patternLineIndex, ITileFactory tileFactory)
    {
        // dummy
    }

    public void AddTilesToFloorLine(IReadOnlyList<TileType> tilesToAdd, ITileFactory tileFactory)
    {
        // dummy
    }

    public void DoWallTiling(ITileFactory tileFactory)
    {
        // dummy
    }

    public void CalculateFinalBonusScores()
    {
        // dummy
    }
}