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
        IPlayer[] playerList = new IPlayer[table.SeatedPlayers.Count];
        for (int i = 0; i < table.SeatedPlayers.Count; i++)
        {
            playerList[i] = table.SeatedPlayers[i];
        }

        ITileBag tileBag = new TileBag();
        // Vul de TileBag met 20 tegels van elk type
        foreach (TileType tileType in Enum.GetValues(typeof(TileType)).Cast<TileType>().Where(t => t != TileType.StartingTile))
        {
            tileBag.AddTiles(20, tileType);
        }

        // Creëer de TileFactory met het aantal displays uit de tafel preferences
        ITileFactory tileFactory = new TileFactory(table.Preferences.NumberOfFactoryDisplays, tileBag);

        IGame game = new Game(Guid.NewGuid(), tileFactory, playerList);


        return game;
    }
}