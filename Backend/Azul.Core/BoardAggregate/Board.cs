using Azul.Core.BoardAggregate.Contracts;
using Azul.Core.TileFactoryAggregate.Contracts;
using System.Linq;

namespace Azul.Core.BoardAggregate;

internal class Board : IBoard
{
    public IPatternLine[] PatternLines { get; } = new IPatternLine[5];
    public TileSpot[,] Wall { get; } = new TileSpot[5, 5];
    public TileSpot[] FloorLine { get; } = new TileSpot[7];
    public int Score { get; private set; } = 0;

    public bool HasCompletedHorizontalLine => Enumerable.Range(0, 5).Any(i => Enumerable.Range(0, 5).All(k => Wall[i, k].HasTile));
    public bool HasCompletedVerticalLine => Enumerable.Range(0, 5).Any(k => Enumerable.Range(0, 5).All(i => Wall[i, k].HasTile));
    public bool HasCompletedAllTilesOfAColor
    {
        get
        {
            foreach (TileType type in Enum.GetValues(typeof(TileType)))
            {
                if (type == TileType.StartingTile) continue;
                if (Wall.Cast<TileSpot>().Count(ts => ts.HasTile && ts.Type == type) == 5)
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
            PatternLines[i] = new PatternLine(i + 1);

        // ✅ Corrigeer muur met geldige en vaste TileTypes
        TileType[,] wallLayout = new TileType[5, 5]
        {
            { TileType.PlainBlue, TileType.YellowRed, TileType.PlainRed, TileType.BlackBlue, TileType.WhiteTurquoise },
            { TileType.WhiteTurquoise, TileType.PlainBlue, TileType.YellowRed, TileType.PlainRed, TileType.BlackBlue },
            { TileType.BlackBlue, TileType.WhiteTurquoise, TileType.PlainBlue, TileType.YellowRed, TileType.PlainRed },
            { TileType.PlainRed, TileType.BlackBlue, TileType.WhiteTurquoise, TileType.PlainBlue, TileType.YellowRed },
            { TileType.YellowRed, TileType.PlainRed, TileType.BlackBlue, TileType.WhiteTurquoise, TileType.PlainBlue }
        };

        for (int i = 0; i < 5; i++)
            for (int k = 0; k < 5; k++)
                Wall[i, k] = new TileSpot(wallLayout[i, k]);

        for (int i = 0; i < 7; i++)
            FloorLine[i] = new TileSpot();
    }

    public void AddTilesToPatternLine(IReadOnlyList<TileType> tilesToAdd, int patternLineIndex, ITileFactory tileFactory)
    {
        if (patternLineIndex < 0 || patternLineIndex >= PatternLines.Length)
            throw new ArgumentException("Invalid pattern line index.", nameof(patternLineIndex));
        if (tilesToAdd == null || tilesToAdd.Count == 0)
            throw new ArgumentException("No tiles provided to add.", nameof(tilesToAdd));

        var patternLine = PatternLines[patternLineIndex];
        var validTileType = tilesToAdd.Last();
        var validTiles = tilesToAdd.Where(t => t == validTileType && t != TileType.StartingTile).ToList();
        var overflowTiles = tilesToAdd.Where(t => t != validTileType || t == TileType.StartingTile).ToList();

        // ✅ Controle: Heeft deze rij al deze tegelsoort?
        for (int k = 0; k < 5; k++)
        {
            var spot = Wall[patternLineIndex, k];
            if (spot.HasTile && spot.Type == validTileType)
            {
                throw new InvalidOperationException("Cannot add tiles to a pattern line when the corresponding wall row already has a tile of that type.");
            }
        }

        if (validTiles.Count > 0)
        {
            try
            {
                patternLine.TryAddTiles(validTileType, validTiles.Count, out int remainingNumberOfTiles);
                if (remainingNumberOfTiles > 0)
                    overflowTiles.AddRange(Enumerable.Repeat(validTileType, remainingNumberOfTiles));
            }
            catch (InvalidOperationException)
            {
                overflowTiles.AddRange(validTiles);
            }
        }

        AddTilesToFloorLine(overflowTiles, tileFactory);
    }

    public void AddTilesToFloorLine(IReadOnlyList<TileType> tilesToAdd, ITileFactory tileFactory)
    {
        int floorLineIndex = 0;
        foreach (var tile in tilesToAdd)
        {
            while (floorLineIndex < FloorLine.Length && FloorLine[floorLineIndex].HasTile)
                floorLineIndex++;
            if (floorLineIndex < FloorLine.Length)
                FloorLine[floorLineIndex++].PlaceTile(tile);
            else
                tileFactory.AddToUsedTiles(tile);
        }

        CalculateFloorLinePenalty();
    }

    public void DoWallTiling(ITileFactory tileFactory)
    {
        for (int i = 0; i < PatternLines.Length; i++)
        {
            var patternLine = PatternLines[i];
            if (!patternLine.IsComplete)
                continue;

            var tileToPlace = patternLine.TileType;
            int tileCount = patternLine.NumberOfTiles;
            int wallRow = i;
            int wallCol = -1;

            for (int k = 0; k < 5; k++)
            {
                if (Wall[wallRow, k].Type == tileToPlace)
                {
                    wallCol = k;
                    break;
                }
            }

            if (wallCol != -1 && !Wall[wallRow, wallCol].HasTile)
            {
                Wall[wallRow, wallCol].PlaceTile(tileToPlace!.Value);
                Score += CalculateWallScore(wallRow, wallCol);
                patternLine.Clear();
                for (int j = 0; j < tileCount - 1; j++)
                    tileFactory.AddToUsedTiles(tileToPlace!.Value);
            }
            else
            {
                for (int j = 0; j < tileCount; j++)
                    tileFactory.AddToUsedTiles(tileToPlace!.Value);
                patternLine.Clear();
            }
        }

        foreach (var tileSpot in FloorLine.Where(ts => ts.HasTile))
        {
            tileFactory.AddToUsedTiles(tileSpot.Type!.Value);
            tileSpot.Clear();
        }

        ResetFloorLine();
    }

    private int CalculateWallScore(int row, int col)
    {
        int score = 1;
        for (int i = col - 1; i >= 0 && Wall[row, i].HasTile; i--) score++;
        for (int i = col + 1; i < 5 && Wall[row, i].HasTile; i++) score++;
        for (int i = row - 1; i >= 0 && Wall[i, col].HasTile; i--) score++;
        for (int i = row + 1; i < 5 && Wall[i, col].HasTile; i++) score++;
        return score;
    }

    private void CalculateFloorLinePenalty()
    {
        int penalty = 0;
        int tilesOnFloorLine = FloorLine.Count(ts => ts.HasTile);
        for (int i = 0; i < tilesOnFloorLine; i++)
            penalty += (i < 2) ? 1 : (i < 4) ? 2 : 3;
        Score = Math.Max(0, Score - penalty);
    }

    private void ResetFloorLine()
    {
        foreach (var spot in FloorLine)
            spot.Clear();
    }

    public void CalculateFinalBonusScores()
    {
        if (HasCompletedHorizontalLine) Score += 5;
        if (HasCompletedVerticalLine) Score += 2;
        if (HasCompletedAllTilesOfAColor) Score += 10;
    }
}
