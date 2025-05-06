using Azul.Core.BoardAggregate.Contracts;
using Azul.Core.TileFactoryAggregate.Contracts;
using System.Linq;

namespace Azul.Core.BoardAggregate;

/// <inheritdoc cref="IBoard"/>
internal class Board : IBoard
{
    public IPatternLine[] PatternLines { get; } = new IPatternLine[5]; // 5 lijnen voor Azul
    public TileSpot[,] Wall { get; } = new TileSpot[5, 5]; // 5x5 muur
    public TileSpot[] FloorLine { get; } = new TileSpot[7]; // Floorline met ruimte voor 7 tegels
    public int Score { get; private set; } = 0;
    public bool HasCompletedHorizontalLine => Wall.Cast<TileSpot>().GroupBy(ts => ts.Y).Any(g => g.All(ts => ts.HasTile));
    public bool HasCompletedVerticalLine => Wall.Cast<TileSpot>().GroupBy(ts => ts.X).Any(g => g.All(ts => ts.HasTile));
    public bool HasCompletedAllTilesOfAColor
    {
        get
        {
            for (int color = 0; color < 5; color++)
            {
                if (Wall.Cast<TileSpot>().Count(ts => ts.HasTile && (int)ts.Tile == 15 + color) == 5)
                {
                    return true;
                }
            }
            return false;
        }
    }

    public Board()
    {
        for (int i = 0; i < 5; i++)
        {
            PatternLines[i] = new PatternLine(i + 1); // Lijnlengtes 1 tot 5
        }

        for (int i = 0; i < 5; i++)
        {
            for (int k = 0; k < 5; k++)
            {
                Wall[i, k] = new TileSpot((TileType)(15 + k - i));
            }
        }

        for (int i = 0; i < 7; i++)
        {
            FloorLine[i] = new TileSpot();
        }
    }

    public void AddTilesToPatternLine(IReadOnlyList<TileType> tilesToAdd, int patternLineIndex, ITileFactory tileFactory)
    {
        if (patternLineIndex < 0 || patternLineIndex >= PatternLines.Length)
        {
            throw new ArgumentOutOfRangeException(nameof(patternLineIndex), "Invalid pattern line index.");
        }

        var patternLine = PatternLines[patternLineIndex];
        if (patternLine.HasTile && patternLine.Tile != tilesToAdd.First())
        {
            // Illegal move: pattern line already has a different tile type
            tileFactory.AddToUsedTiles(tilesToAdd); // Return all tiles to the factory
            return;
        }

        int tilesAdded = patternLine.AddTiles(tilesToAdd);
        int remainingTiles = tilesToAdd.Count - tilesAdded;

        if (remainingTiles > 0)
        {
            tileFactory.AddToUsedTiles(tilesToAdd.Skip(tilesAdded)); // Return excess tiles
        }
    }

    public void AddTilesToFloorLine(IReadOnlyList<TileType> tilesToAdd, ITileFactory tileFactory)
    {
        int nextFreeSlot = FloorLine.TakeWhile(ts => ts.HasTile).Count();

        foreach (var tile in tilesToAdd)
        {
            if (nextFreeSlot < FloorLine.Length)
            {
                FloorLine[nextFreeSlot] = new TileSpot(tile);
                nextFreeSlot++;
            }
            else
            {
                tileFactory.AddToUsedTiles(tile);
            }
        }
        CalculateFloorLinePenalty();
    }

    public void DoWallTiling(ITileFactory tileFactory)
    {
        for (int i = 0; i < PatternLines.Length; i++)
        {
            var patternLine = PatternLines[i];
            if (patternLine.IsFull)
            {
                var tileToPlace = patternLine.Tile;
                int wallRow = i;
                int wallCol = -1;

                // Find the correct column in the wall for this tile type in this row
                for (int k = 0; k < 5; k++)
                {
                    if (Wall[wallRow, k].PossibleTile == tileToPlace)
                    {
                        wallCol = k;
                        break;
                    }
                }

                if (wallCol != -1 && !Wall[wallRow, wallCol].HasTile)
                {
                    Wall[wallRow, wallCol].PlaceTile(tileToPlace);
                    Score += CalculateWallScore(wallRow, wallCol);
                    patternLine.Clear();
                    // Return the remaining tiles from the pattern line to the factory
                    for (int j = 0; j < patternLine.FilledSlots - 1; j++)
                    {
                        tileFactory.AddToUsedTiles(tileToPlace);
                    }
                }
                else
                {
                    // Should not happen in a valid game state, but handle it defensively
                    for (int j = 0; j < patternLine.FilledSlots; j++)
                    {
                        tileFactory.AddToUsedTiles(tileToPlace);
                    }
                    patternLine.Clear();
                }
            }
        }

        // Clear the floor line and return tiles to the factory
        foreach (var tileSpot in FloorLine.Where(ts => ts.HasTile))
        {
            tileFactory.AddToUsedTiles(tileSpot.Tile);
            tileSpot.RemoveTile();
        }
        ResetFloorLine();
    }

    private int CalculateWallScore(int row, int col)
    {
        int score = 1;

        // Check horizontal
        int left = col - 1;
        while (left >= 0 && Wall[row, left].HasTile)
        {
            score++;
            left--;
        }
        int right = col + 1;
        while (right < 5 && Wall[row, right].HasTile)
        {
            score++;
            right++;
        }

        // Check vertical
        int up = row - 1;
        while (up >= 0 && Wall[up, col].HasTile)
        {
            score++;
            up--;
        }
        int down = row + 1;
        while (down < 5 && Wall[down, col].HasTile)
        {
            score++;
            down++;
        }

        return score;
    }

    private void CalculateFloorLinePenalty()
    {
        int penalty = 0;
        int tilesOnFloorLine = FloorLine.Count(ts => ts.HasTile);

        for (int i = 0; i < tilesOnFloorLine; i++)
        {
            if (i == 0 || i == 1) penalty += 1;
            else if (i == 2 || i == 3) penalty += 2;
            else penalty += 3;
        }

        Score = Math.Max(0, Score - penalty);
    }

    private void ResetFloorLine()
    {
        for (int i = 0; i < FloorLine.Length; i++)
        {
            FloorLine[i].RemoveTile();
        }
    }

    public void CalculateFinalBonusScores()
    {
        if (HasCompletedHorizontalLine)
        {
            Score += 5;
        }

        if (HasCompletedVerticalLine)
        {
            Score += 2;
        }

        if (HasCompletedAllTilesOfAColor)
        {
            Score += 10;
        }
    }
}