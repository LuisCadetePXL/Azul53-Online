using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.BoardAggregate;

/// <summary>
/// Represents a spot on the board or floor line where a tile can be placed.
/// </summary>
public class TileSpot
{
    /// <summary>
    /// The type of tile that can be placed on this spot.
    /// If null, any type of tile can be placed.
    /// </summary>
    public TileType? Type { get; private set; }

    /// <summary>
    /// Indicates whether a tile is placed on this spot.
    /// </summary>
    public bool HasTile { get; private set; }

    public TileSpot(TileType? type = null)
    {
        Type = type;
        HasTile = false;
    }

    public void PlaceTile(TileType type)
    {
        if (HasTile)
        {
            throw new InvalidOperationException("Cannot place a tile on a spot that already has a tile.");
        }

        if (Type != null && Type != type)
        {
            throw new InvalidOperationException("Cannot place a tile of a different type on this spot.");
        }

        Type = type;
        HasTile = true;
    }

    public void Clear()
    {
        Type = null;
        HasTile = false;
    }
}