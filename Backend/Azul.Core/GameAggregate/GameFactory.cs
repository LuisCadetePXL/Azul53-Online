using System.Drawing;
using Azul.Core.GameAggregate.Contracts;
using Azul.Core.PlayerAggregate.Contracts;
using Azul.Core.TableAggregate.Contracts;
using Azul.Core.TileFactoryAggregate;
using Azul.Core.TileFactoryAggregate.Contracts;

namespace Azul.Core.GameAggregate;

internal class GameFactory : IGameFactory
{
    public IGame CreateNewForTable(ITable table)
    {
        IPlayer[] playerList =  new IPlayer[table.SeatedPlayers.Count];
        for (int i = 0; i < table.SeatedPlayers.Count; i++)
        {
            playerList[i] = table.SeatedPlayers[i];
        }

        ITileBag tileBag = new TileBag();
        ITileFactory tileFactory = new TileFactory(5, tileBag);

       IGame game = new Game(Guid.NewGuid(),tileFactory,playerList);

        return game;
    }
}