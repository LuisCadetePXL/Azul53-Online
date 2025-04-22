using Azul.Core.TableAggregate.Contracts;
using Azul.Core.Util;
using Azul.Infrastructure.Util;

namespace Azul.Infrastructure;

/// <inheritdoc cref="ITableRepository"/>
internal class InMemoryTableRepository : ITableRepository
{
    private readonly ExpiringDictionary<Guid, ITable> _tableDictionary;

    public InMemoryTableRepository()
    {
        _tableDictionary = new ExpiringDictionary<Guid, ITable>(TimeSpan.FromMinutes(15));
    }

    public void Add(ITable table)
    {
        _tableDictionary.AddOrReplace(table.Id, table);
    }

    public ITable Get(Guid tableId)
    {
        if (_tableDictionary.TryGetValue(tableId, out ITable table))
        {
            return table!;
        }
        throw new DataNotFoundException();
    }

    public void Remove(Guid tableId)
    {
        _tableDictionary.TryRemove(tableId, out ITable _);
    }

    public IList<ITable> FindTablesWithAvailableSeats(ITablePreferences preferences)
    {
        //TODO: loop over all tables (user the Values property of _tableDictionary)
        //and check if those tables have the same preferences and have seats available.
        //Put the tables that have the same preferences and have seats available in a list and return that list.
        var result = new List<ITable>();

        foreach (var table in _tableDictionary.Values)
        {
            if (table.HasAvailableSeat && table.Preferences.Equals(preferences))
            {
                result.Add(table);
            }
        }

        return result;
    }
}