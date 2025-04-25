using Azul.Core.GameAggregate.Contracts;
using Azul.Core.PlayerAggregate;
using Azul.Core.PlayerAggregate.Contracts;
using Azul.Core.TableAggregate.Contracts;
using Azul.Core.UserAggregate;
using System.Security;

namespace Azul.Core.TableAggregate;

/// <inheritdoc cref="ITableManager"/>
internal class TableManager : ITableManager
{
    private readonly ITableRepository _tableRepository;
    private readonly ITableFactory _tableFactory;
    private readonly IGameRepository _gameRepository;
    private readonly IGameFactory _gameFactory;
    private readonly IGamePlayStrategy _gamePlayStrategy;

    public TableManager(
        ITableRepository tableRepository,
        ITableFactory tableFactory,
        IGameRepository gameRepository,
        IGameFactory gameFactory,
        IGamePlayStrategy gamePlayStrategy)
    {
        _tableRepository = tableRepository;
        _tableFactory = tableFactory;
        _gameRepository = gameRepository;
        _gameFactory = gameFactory;
        _gamePlayStrategy = gamePlayStrategy;
    }

    public ITable JoinOrCreateTable(User user, ITablePreferences preferences)
    {
        IList<ITable> avalaibleTables = _tableRepository.FindTablesWithAvailableSeats(preferences);

        if (avalaibleTables.Count == 0) {
            ITable newTable = _tableFactory.CreateNewForUser(user, preferences);
            _tableRepository.Add(newTable);
            return newTable;
        }
        else
        {
            ITable avalaibleTable = avalaibleTables.FirstOrDefault();
            if (avalaibleTable == null)
            {
                throw new InvalidOperationException("No available table found despite repository returning results.");
            }

            avalaibleTable.Join(user);
            return avalaibleTable;
        }

        //Find a table with available seats that matches the given preferences
        //If no table is found, create a new table. Otherwise, take the first available table

    }

    public void LeaveTable(Guid tableId, User user)
    {
        ITable currentTable = GetCurrentTable(tableId);
        currentTable.Leave(user.Id);
        if (currentTable.SeatedPlayers.Count == 0)
        {
            _tableRepository.Remove(tableId);
        }
    }


    private ITable GetCurrentTable(Guid tableId) {
       ITable tabel =  _tableRepository.Get(tableId);
        if (tabel == null)
        {
            throw new Exception($"Table with ID {tableId} not found.");
        }
        return tabel;
    }

    private IGame CreateGame(ITable currentTable)
    {
        IGame newGame = _gameFactory.CreateNewForTable(currentTable);
        _gameRepository.Add(newGame);
        return newGame;
    }

    public IGame StartGameForTable(Guid tableId)
    {
        ITable currentTable = GetCurrentTable(tableId);
        if (currentTable.SeatedPlayers.Count < currentTable.Preferences.NumberOfPlayers)
        {
            throw new InvalidOperationException("There are not enough players to start a game.");
        }
        IGame newGame = CreateGame(currentTable);
        currentTable.GameId = newGame.Id;
        return newGame;
    }

    public void FillWithArtificialPlayers(Guid tableId, User user)
    {
        //TODO: Implement this method when you are working on the EXTRA requirement 'Play against AI'
        throw new NotImplementedException();
    }
}