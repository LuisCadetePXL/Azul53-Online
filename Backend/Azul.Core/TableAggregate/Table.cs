using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using Azul.Core.PlayerAggregate;
using Azul.Core.PlayerAggregate.Contracts;
using Azul.Core.TableAggregate.Contracts;
using Azul.Core.UserAggregate;

namespace Azul.Core.TableAggregate;

/// <inheritdoc cref="ITable"/>
internal class Table : ITable
{
    private readonly List<IPlayer> _seatedPlayers = new();

    internal Table(Guid id, ITablePreferences preferences)
    {
        Id = id;
        Preferences = preferences;
    }

    public Guid Id { get; }

    public ITablePreferences Preferences { get; }

    public IReadOnlyList<IPlayer> SeatedPlayers => _seatedPlayers.AsReadOnly();

    public bool HasAvailableSeat => _seatedPlayers.Count < Preferences.NumberOfPlayers;

    public Guid GameId { get; set; }

    public void FillWithArtificialPlayers(IGamePlayStrategy gamePlayStrategy)
    {
        //while (HasAvailableSeat)
        //{
        //    var aiPlayer = gamePlayStrategy.;
        //    _seatedPlayers.Add(aiPlayer);
        //}
    }

    public void Join(User user)
    {
        if (user == null)
        {
            throw new ArgumentNullException(nameof(user));
        }

        if (!HasAvailableSeat)
        {
            throw new InvalidOperationException("No available seats at the table.");
        }

        if (_seatedPlayers.Any(p => p.Id == user.Id))
        {
            throw new InvalidOperationException("User is already seated at the table.");
        }

        // Maak een IPlayer (bijv. HumanPlayer) van de User
        IPlayer player = new HumanPlayer(user.Id, user.UserName, user.LastVisitToPortugal);

        _seatedPlayers.Add(player);
    }

    public void Join(IPlayer player)
    {
        if (player == null)
        {
            throw new ArgumentNullException(nameof(player));
        }

        if (!HasAvailableSeat)
        {
            throw new InvalidOperationException("No available seats at the table.");
        }

        if (_seatedPlayers.Any(p => p.Id == player.Id))
        {
            throw new InvalidOperationException("Player is already seated at the table.");
        }

        _seatedPlayers.Add(player);
    }


    public void Leave(Guid userId)
    {
        IPlayer playerToRemove = _seatedPlayers.FirstOrDefault(p => p.Id == userId);
        if (playerToRemove == null)
        {
            throw new InvalidOperationException("User is not seated at the table.");
        }

        _seatedPlayers.Remove(playerToRemove);
    }
}
