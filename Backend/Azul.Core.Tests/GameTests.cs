using System;
using System.Collections.Generic;
using System.Linq;
using Moq;
using NUnit.Framework;
using Azul.Core.GameAggregate;
using Azul.Core.GameAggregate.Contracts;
using Azul.Core.PlayerAggregate.Contracts;
using Azul.Core.Tests.Builders;
using Azul.Core.Tests.Extensions;
using Azul.Core.TileFactoryAggregate.Contracts;
using Guts.Client.Core;

namespace Azul.Core.Tests
{
    [ProjectComponentTestFixture("1TINProject", "Azul", "Game",
        @"Azul.Core\GameAggregate\Game.cs;")]
    public class GameTests
    {
        private Mock<ITileFactory> _tileFactoryMock = null!;
        private PlayerMockBuilder _player1MockBuilder = null!;
        private PlayerMockBuilder _player2MockBuilder = null!;
        private IGame? _game;
        private List<TileType> _tilesToPlaceOfPlayer1 = [];
        private List<TileType> _tilesToPlaceOfPlayer2 = [];
        private Mock<ITableCenter> _tableCenterMock = null!;
        private TileFactoryMockBuilder _tileFactoryMockBuilder = null!;

        [SetUp]
        public void BeforeEachTest()
        {
            _tileFactoryMockBuilder = new TileFactoryMockBuilder();
            _tileFactoryMock = _tileFactoryMockBuilder.Mock;
            _tableCenterMock = _tileFactoryMockBuilder.TableCenterMock;
            _tilesToPlaceOfPlayer1 = [];
            _tilesToPlaceOfPlayer2 = [];
            _player1MockBuilder = new PlayerMockBuilder().WithName("PlayerA").WithTilesToPlaceList(_tilesToPlaceOfPlayer1);
            _player2MockBuilder = new PlayerMockBuilder().WithName("PlayerB").WithTilesToPlaceList(_tilesToPlaceOfPlayer2);
            _game = new Game(Guid.NewGuid(), _tileFactoryMock.Object, new[] { _player1MockBuilder.Object, _player2MockBuilder.Object }) as IGame;
        }

        [MonitoredTest]
        public void Class_ShouldBeInternal_SoThatItCanOnlyBeUsedInTheCoreProject()
        {
            Assert.That(typeof(Game).IsNotPublic, Is.True, "use 'internal class' instead of 'public class'");
        }

        [MonitoredTest]
        public void Class_ShouldImplement_IGame()
        {
            Assert.That(typeof(Game).IsAssignableTo(typeof(IGame)), Is.True);
        }

        [MonitoredTest]
        public void IGame_Interface_ShouldHaveCorrectMembers()
        {
            var type = typeof(IGame);
            type.AssertInterfaceProperty(nameof(IGame.Id), true, false);
            type.AssertInterfaceProperty(nameof(IGame.TileFactory), true, false);
            type.AssertInterfaceProperty(nameof(IGame.Players), true, false);
            type.AssertInterfaceProperty(nameof(IGame.PlayerToPlayId), true, false);
            type.AssertInterfaceProperty(nameof(IGame.RoundNumber), true, false);
            type.AssertInterfaceProperty(nameof(IGame.HasEnded), true, false);

            type.AssertInterfaceMethod(nameof(IGame.TakeTilesFromFactory), typeof(void), typeof(Guid), typeof(Guid), typeof(TileType));
            type.AssertInterfaceMethod(nameof(IGame.PlaceTilesOnPatternLine), typeof(void), typeof(Guid), typeof(int));
            type.AssertInterfaceMethod(nameof(IGame.PlaceTilesOnFloorLine), typeof(void), typeof(Guid));
        }

        [MonitoredTest]
        [TestCase("01/01/2000", "02/01/2000", "PlayerB")]
        [TestCase("20/01/2020", "19/01/2020", "PlayerA")]
        [TestCase("15/12/2024", "", "PlayerA")]
        [TestCase("", "10/10/2010", "PlayerB")]
        [TestCase("", "", "PlayerA")]
        public void Constructor_ShouldLetPlayerThatLastVisitedPortugalStart(string playerALastVisit, string playerBLastVisit, string expectedPlayerToStart)
        {
            Class_ShouldImplement_IGame();

            // Arrange
            DateOnly? playerALastVisitDate = null;
            if (!string.IsNullOrEmpty(playerALastVisit))
            {
                playerALastVisitDate = DateOnly.ParseExact(playerALastVisit, "dd/MM/yyyy");
            }
            var playerA = new PlayerMockBuilder()
                .WithName("PlayerA")
                .WithLastVisitToPortugal(playerALastVisitDate)
                .WithTilesToPlaceList(_tilesToPlaceOfPlayer1)
                .Object;

            DateOnly? playerBLastVisitDate = null;
            if (!string.IsNullOrEmpty(playerBLastVisit))
            {
                playerBLastVisitDate = DateOnly.ParseExact(playerBLastVisit, "dd/MM/yyyy");
            }
            var playerB = new PlayerMockBuilder()
                .WithName("PlayerB")
                .WithLastVisitToPortugal(playerBLastVisitDate)
                .WithTilesToPlaceList(_tilesToPlaceOfPlayer2).
                Object;

            IPlayer expectedPlayer = expectedPlayerToStart == "PlayerA" ? playerA : playerB;
            IPlayer otherPlayer = expectedPlayerToStart == "PlayerA" ? playerB : playerA;


            // Act
            _game = new Game(Guid.NewGuid(), _tileFactoryMock.Object, new[] { playerA, playerB }) as IGame;

            // Assert
            Assert.That(_game!.PlayerToPlayId, Is.EqualTo(expectedPlayer.Id),
                $"{expectedPlayer.Name} should be the player to start. " +
                $"(Last visit of player = {expectedPlayer.LastVisitToPortugal}, last visit of other player = {otherPlayer.LastVisitToPortugal})");
        }

        [MonitoredTest]
        public void Constructor_ShouldStartFactoryOfferPhase()
        {
            Class_ShouldImplement_IGame();

            _tableCenterMock.Verify(tc => tc.AddStartingTile(), Times.Once,
                "The 'AddStartingTile' method of the table center should have been called");

            Assert.That(_game!.Players.All(p => !p.HasStartingTile), Is.True,
                "None of the players should have the starting tile (it is in the table center now)");

            _tileFactoryMock.Verify(tf => tf.FillDisplays(), Times.Once,
                "The 'FillDisplays' method of the tile factory should have been called");
        }

        [MonitoredTest]
        public void TakeTilesFromFactory_ShouldAddTilesToPlayer()
        {
            Class_ShouldImplement_IGame();
            Assert.That(_game!.PlayerToPlayId, Is.Not.EqualTo(Guid.Empty),
                "The PlayerToPlayId should be set after construction of the game");

            // Arrange
            _tileFactoryMockBuilder.CompletelyFilled();

            Guid displayId = Guid.NewGuid();
            TileType tileType = Random.Shared.NextTileType();
            int numberOfTiles = Random.Shared.Next(1, 5);
            var takenTiles = new List<TileType>(numberOfTiles);
            for (int i = 0; i < numberOfTiles; i++)
            {
                takenTiles.Add(tileType);
            }
            _tileFactoryMock.Setup(tf => tf.TakeTiles(displayId, tileType)).Returns(takenTiles);



            PlayerMockBuilder playerToPlayMockBuilder = GetPlayerToPlayMockBuilder();
            IPlayer playerToPlay = playerToPlayMockBuilder.Object;
            List<TileType> tilesToPlace = GetTilesToPlaceOfPlayer(playerToPlay.Id);

            // Act
            _game.TakeTilesFromFactory(playerToPlay.Id, displayId, tileType);

            // Assert
            _tileFactoryMock.Verify(tf => tf.TakeTiles(displayId, tileType), Times.Once,
                "The 'TakeTiles' method of the factory is not called correctly");
            Assert.That(playerToPlay.TilesToPlace, Is.EquivalentTo(takenTiles),
                $"The taken tiles should be in the 'TilesToPlace' of '{playerToPlay.Name}'");
        }

        [MonitoredTest]
        public void TakeTilesFromFactory_NotPlayersTurn_ShouldThrowInvalidOperationException()
        {
            Class_ShouldImplement_IGame();

            Assert.That(_game!.PlayerToPlayId, Is.Not.EqualTo(Guid.Empty),
                "The PlayerToPlayId should be set after construction of the game");

            // Arrange
            _tileFactoryMockBuilder.CompletelyFilled();

            PlayerMockBuilder otherPlayerMockBuilder = _game.PlayerToPlayId == _player1MockBuilder.Object.Id ? _player2MockBuilder : _player1MockBuilder;
            IPlayer otherPlayer = otherPlayerMockBuilder.Object;
            Guid displayId = Guid.NewGuid();
            TileType tileType = Random.Shared.NextTileType();
            _tileFactoryMock.Setup(tf => tf.TakeTiles(displayId, tileType)).Returns(new List<TileType>());

            // Act + Assert
            Assert.That(() => _game.TakeTilesFromFactory(otherPlayer.Id, displayId, tileType),
                Throws.InvalidOperationException.With.Message.ContainsOne("turn", "beurt"));
        }

        [MonitoredTest]
        public void TakeTilesFromFactory_PlayerAlreadyHasTilesToPlace_ShouldThrowInvalidOperationException()
        {
            Class_ShouldImplement_IGame();

            Assert.That(_game!.PlayerToPlayId, Is.Not.EqualTo(Guid.Empty),
                "The PlayerToPlayId should be set after construction of the game");

            // Arrange
            _tileFactoryMockBuilder.CompletelyFilled();

            PlayerMockBuilder playerToPlayMockBuilder = GetPlayerToPlayMockBuilder();
            IPlayer playerToPlay = playerToPlayMockBuilder.Object;
            List<TileType> tilesToPlace = GetTilesToPlaceOfPlayer(playerToPlay.Id);
            tilesToPlace.Add(TileType.PlainRed);

            Guid displayId = Guid.NewGuid();
            TileType tileType = Random.Shared.NextTileType();
            int numberOfTiles = Random.Shared.Next(1, 5);
            var takenTiles = new List<TileType>(numberOfTiles);
            for (int i = 0; i < numberOfTiles; i++)
            {
                takenTiles.Add(tileType);
            }
            _tileFactoryMock.Setup(tf => tf.TakeTiles(displayId, tileType)).Returns(takenTiles);

            // Act + Assert
            Assert.That(() => _game.TakeTilesFromFactory(playerToPlay.Id, displayId, tileType),
                Throws.InvalidOperationException.With.Message.ContainsOne("place", "plaatsen"));
        }

        [MonitoredTest]
        public void TakeTilesFromFactory_OneOfTheTakenTilesIsTheStartingTile_ShouldAddTilesToPlayer_ShouldMarkPlayerAsHavingStartingTile()
        {
            Class_ShouldImplement_IGame();

            Assert.That(_game!.PlayerToPlayId, Is.Not.EqualTo(Guid.Empty),
                "The PlayerToPlayId should be set after construction of the game");

            // Arrange
            _tileFactoryMockBuilder.CompletelyFilled();

            Guid displayId = Guid.NewGuid();
            TileType tileType = Random.Shared.NextTileType();
            int numberOfTiles = Random.Shared.Next(1, 4);
            var takenTiles = new List<TileType>(numberOfTiles);
            for (int i = 0; i < numberOfTiles; i++)
            {
                takenTiles.Add(tileType);
            }
            takenTiles.Add(TileType.StartingTile);
            _tileFactoryMock.Setup(tf => tf.TakeTiles(displayId, tileType)).Returns(takenTiles);

            PlayerMockBuilder playerToPlayMockBuilder = GetPlayerToPlayMockBuilder();
            IPlayer playerToPlay = playerToPlayMockBuilder.Object;
            List<TileType> tilesToPlace = GetTilesToPlaceOfPlayer(playerToPlay.Id);

            // Act
            _game.TakeTilesFromFactory(playerToPlay.Id, displayId, tileType);

            // Assert
            _tileFactoryMock.Verify(tf => tf.TakeTiles(displayId, tileType), Times.Once,
                "The 'TakeTiles' method of the factory is not called correctly");
            Assert.That(playerToPlay.TilesToPlace, Is.EquivalentTo(takenTiles),
                $"The taken tiles should be in the 'TilesToPlace' of '{playerToPlay.Name}'");
            Assert.That(playerToPlay.HasStartingTile, Is.True,
                $"The player '{playerToPlay.Name}' should be marked as having the starting tile");
        }

        [MonitoredTest]
        public void PlaceTilesOnPatternLine_ShouldPlaceTilesInCorrectPatternLineOfThePlayerBoard_ShouldGiveTurnToOtherPlayer()
        {
            Class_ShouldImplement_IGame();

            // Arrange
            _tileFactoryMockBuilder.CompletelyFilled();

            PlayerMockBuilder playerToPlayMockBuilder = GetPlayerToPlayMockBuilder();
            IPlayer playerToPlay = playerToPlayMockBuilder.Object;
            List<TileType> tilesToPlace = GetTilesToPlaceOfPlayer(playerToPlay.Id);
            tilesToPlace.Add(TileType.WhiteTurquoise);
            tilesToPlace.Add(TileType.WhiteTurquoise);

            int patternLineIndex = Random.Shared.Next(0,5);

            PlayerMockBuilder otherPlayerMockBuilder = _game!.PlayerToPlayId == _player1MockBuilder.Object.Id ? _player2MockBuilder : _player1MockBuilder;
            IPlayer otherPlayer = otherPlayerMockBuilder.Object;

            // Act
            _game.PlaceTilesOnPatternLine(playerToPlay.Id, patternLineIndex);

            // Assert
            playerToPlayMockBuilder.BoardMock.Verify(b => b.AddTilesToPatternLine(playerToPlay.TilesToPlace, patternLineIndex, _game.TileFactory),
                "The 'AddTilesToPatternLine' method of the player's board should be called with the correct parameters");
            Assert.That(tilesToPlace.Count, Is.Zero, "The 'tiles to place' should be cleared after placing the tiles");
            Assert.That(_game.PlayerToPlayId, Is.EqualTo(otherPlayer.Id), "The turn should be given to the other player");
        }

        [MonitoredTest]
        public void PlaceTilesOnPatternLine_NotPlayersTurn_ShouldThrowInvalidOperationException()
        {
            Class_ShouldImplement_IGame();

            Assert.That(_game!.PlayerToPlayId, Is.Not.EqualTo(Guid.Empty),
                "The PlayerToPlayId should be set after construction of the game");

            // Arrange
            _tileFactoryMockBuilder.CompletelyFilled();

            PlayerMockBuilder otherPlayerMockBuilder = _game.PlayerToPlayId == _player1MockBuilder.Object.Id ? _player2MockBuilder : _player1MockBuilder;
            IPlayer otherPlayer = otherPlayerMockBuilder.Object;

            List<TileType> tilesToPlace = GetTilesToPlaceOfPlayer(otherPlayer.Id);
            tilesToPlace.Add(TileType.BlackBlue);
            tilesToPlace.Add(TileType.BlackBlue);

            int patternLineIndex = Random.Shared.Next(0, 5);

            // Act + Assert
            Assert.That(() => _game.PlaceTilesOnPatternLine(otherPlayer.Id, patternLineIndex),
                Throws.InvalidOperationException.With.Message.ContainsOne("turn", "beurt"));
        }

        [MonitoredTest]
        public void PlaceTilesOnPatternLine_PlayerHasNoTilesToPlace_ShouldThrowInvalidOperationException()
        {
            Class_ShouldImplement_IGame();

            Assert.That(_game!.PlayerToPlayId, Is.Not.EqualTo(Guid.Empty),
                "The PlayerToPlayId should be set after construction of the game");

            // Arrange
            _tileFactoryMockBuilder.CompletelyFilled();

            PlayerMockBuilder playerToPlayMockBuilder = GetPlayerToPlayMockBuilder();
            IPlayer playerToPlay = playerToPlayMockBuilder.Object;
            List<TileType> tilesToPlace = GetTilesToPlaceOfPlayer(playerToPlay.Id);
            tilesToPlace.Clear();

            int patternLineIndex = Random.Shared.Next(0, 5);

            // Act + Assert
            Assert.That(() => _game.PlaceTilesOnPatternLine(playerToPlay.Id, patternLineIndex),
                Throws.InvalidOperationException.With.Message.ContainsOne("no tiles", "geen tegels"));

            Assert.That(_game.PlayerToPlayId, Is.EqualTo(playerToPlay.Id), "The turn should stay with the current player");
        }

        [MonitoredTest]
        public void PlaceTilesOnPatternLine_TileFactoryIsEmpty_ShouldStartANewRound()
        {
            Class_ShouldImplement_IGame();

            // Arrange
            _tileFactoryMockBuilder.Empty();

            PlayerMockBuilder playerToPlayMockBuilder = GetPlayerToPlayMockBuilder();
            IPlayer playerToPlay = playerToPlayMockBuilder.Object;
            playerToPlay.HasStartingTile = true;
            List<TileType> tilesToPlace = GetTilesToPlaceOfPlayer(playerToPlay.Id);
            tilesToPlace.Add(TileType.PlainRed);

            int patternLineIndex = Random.Shared.Next(0, 5);

            _tableCenterMock.Invocations.Clear();
            _tileFactoryMock.Invocations.Clear();

            // Act
            _game!.PlaceTilesOnPatternLine(playerToPlay.Id, patternLineIndex);

            // Assert
            foreach (IPlayer player in _game.Players)
            {
                PlayerMockBuilder playerMockBuilder = GetPlayerMockBuilder(player.Id);
                playerMockBuilder.BoardMock.Verify(b => b.DoWallTiling(_game.TileFactory), Times.Once,
                    $"Wall tiling was not done correctly for player '{player.Name}'");
            }

            Assert.That(_game.RoundNumber, Is.EqualTo(2), "The round number should be increased by 1");
            Assert.That(_game.PlayerToPlayId, Is.EqualTo(playerToPlay.Id),
                "The turn should go to the player that had the starting tile");

            _tableCenterMock.Verify(tc => tc.AddStartingTile(), Times.Once,
                "The 'AddStartingTile' method of the table center should have been called");

            Assert.That(_game.Players.All(p => !p.HasStartingTile), Is.True,
                "None of the players should have the starting tile (it is in the table center now)");

            _tileFactoryMock.Verify(tf => tf.FillDisplays(), Times.Once,
                "The 'FillDisplays' method of the tile factory should have been called");

            Assert.That(_game.HasEnded, Is.False, "The game should not have ended yet");
        }

        [MonitoredTest]
        public void PlaceTilesOnPatternLine_TileFactoryIsEmpty_PlayerGetsACompletedHorizontalLineOnTheWall_ShouldEndGame()
        {
            Class_ShouldImplement_IGame();

            // Arrange
            _tileFactoryMockBuilder.Empty();

            PlayerMockBuilder playerToPlayMockBuilder = GetPlayerToPlayMockBuilder();
            playerToPlayMockBuilder.BoardMock.Setup(b => b.HasCompletedHorizontalLine).Returns(true);
            IPlayer playerToPlay = playerToPlayMockBuilder.Object;
            playerToPlay.HasStartingTile = true;
            List<TileType> tilesToPlace = GetTilesToPlaceOfPlayer(playerToPlay.Id);
            tilesToPlace.Add(TileType.YellowRed);

            int patternLineIndex = Random.Shared.Next(0, 5);

            // Act
            _game!.PlaceTilesOnPatternLine(playerToPlay.Id, patternLineIndex);

            // Assert
            foreach (IPlayer player in _game.Players)
            {
                PlayerMockBuilder playerMockBuilder = GetPlayerMockBuilder(player.Id);
                playerMockBuilder.BoardMock.Verify(b => b.DoWallTiling(_game.TileFactory), Times.Once,
                    $"Wall tiling was not done correctly for player '{player.Name}'");

                playerMockBuilder.BoardMock.Verify(b => b.CalculateFinalBonusScores(), Times.Once,
                    $"The 'CalculateFinalBonusScores' method of the board should have been called for player '{player.Name}'");
            }

            Assert.That(_game.HasEnded, Is.True, "The game should have ended");
        }

        [MonitoredTest]
        public void PlaceTilesOnFloorLine_ShouldPlaceTilesInFloorLineOfThePlayerBoard_ShouldGiveTurnToOtherPlayer()
        {
            Class_ShouldImplement_IGame();

            // Arrange
            _tileFactoryMockBuilder.CompletelyFilled();

            PlayerMockBuilder playerToPlayMockBuilder = GetPlayerToPlayMockBuilder();
            IPlayer playerToPlay = playerToPlayMockBuilder.Object;
            List<TileType> tilesToPlace = GetTilesToPlaceOfPlayer(playerToPlay.Id);
            tilesToPlace.Add(TileType.WhiteTurquoise);
            tilesToPlace.Add(TileType.WhiteTurquoise);

            PlayerMockBuilder otherPlayerMockBuilder = _game!.PlayerToPlayId == _player1MockBuilder.Object.Id ? _player2MockBuilder : _player1MockBuilder;
            IPlayer otherPlayer = otherPlayerMockBuilder.Object;

            // Act
            _game.PlaceTilesOnFloorLine(playerToPlay.Id);

            // Assert
            playerToPlayMockBuilder.BoardMock.Verify(b => b.AddTilesToFloorLine(playerToPlay.TilesToPlace, _game.TileFactory),
                "The 'AddTilesToFloorLine' method of the player's board should be called with the correct parameters");
            Assert.That(tilesToPlace.Count, Is.Zero, "The 'tiles to place' should be cleared after placing the tiles");
            Assert.That(_game.PlayerToPlayId, Is.EqualTo(otherPlayer.Id), "The turn should be given to the other player");
        }

        private PlayerMockBuilder GetPlayerToPlayMockBuilder()
        {
            if (_game!.PlayerToPlayId == _player1MockBuilder.Object.Id)
            {
                return _player1MockBuilder;
            }
            return _player2MockBuilder;
        }

        private PlayerMockBuilder GetPlayerMockBuilder(Guid playerId)
        {
            if (playerId == _player1MockBuilder.Object.Id)
            {
                return _player1MockBuilder;
            }
            return _player2MockBuilder;
        }

        private List<TileType> GetTilesToPlaceOfPlayer(Guid playerId)
        {
            if (playerId == _player1MockBuilder.Object.Id)
            {
                return _tilesToPlaceOfPlayer1;
            }
            return _tilesToPlaceOfPlayer2;
        }
    }
}
