using System.Drawing;
using Azul.Core.PlayerAggregate.Contracts;

namespace Azul.Core.PlayerAggregate;

/// <inheritdoc cref="IPlayer"/>
internal class HumanPlayer : PlayerBase
{
    public HumanPlayer(Guid id, string name, DateOnly? lastVisitToPortugal)
        : base(id, name, lastVisitToPortugal)
    {
    }
}