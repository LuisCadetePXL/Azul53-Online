using Azul.Core.PlayerAggregate;
using Azul.Core.PlayerAggregate.Contracts;
using Azul.Core.TableAggregate.Contracts;
using Azul.Core.UserAggregate;

namespace Azul.Core.TableAggregate;

/// <inheritdoc cref="ITableFactory"/>
internal class TableFactory : ITableFactory
{
    public ITable CreateNewForUser(User user, ITablePreferences preferences)
{
    if (preferences.NumberOfPlayers <= 0)
    {
        preferences.NumberOfPlayers = 2;
    }

    ITable table = new Table(user.Id, preferences);
    IPlayer player = new HumanPlayer(user.Id, user.UserName, user.LastVisitToPortugal);
    table.Join(player);

    return table;
}





}