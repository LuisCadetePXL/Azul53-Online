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

    public Board()
    {
        for (int i = 0; i < 5; i++)
        {
            PatternLines[i] = new PatternLine(i + 1); // Lijnlengtes 1 tot 5
        }

        for (int i = 0;i < 5; i++)
        {
            for (int k = 0; k < 5; k++) {
                Wall[i, k] = new TileSpot((TileType)(15+k-i));
            }
        }

        for (int i = 0; i < 7; i++)
        {
            FloorLine[i] = new TileSpot();
        }
    }

    public void AddTilesToPatternLine(IReadOnlyList<TileType> tilesToAdd, int patternLineIndex, ITileFactory tileFactory)
    {
        // dummy
    }

    public void AddTilesToFloorLine(IReadOnlyList<TileType> tilesToAdd, ITileFactory tileFactory)
    {
        int i = 0;

        foreach (var tile in tilesToAdd)
        {
            if (i < FloorLine.Length)
            {
                FloorLine[i] = new TileSpot(tile); 
                i++;
            }
            else
            {
                tileFactory.AddToUsedTiles(tile);
            }
        }
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