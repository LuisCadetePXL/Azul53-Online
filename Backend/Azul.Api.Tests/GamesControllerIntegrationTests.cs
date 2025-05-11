using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Azul.Api.Controllers;
using Azul.Api.Models.Input;
using Azul.Api.Models.Output;
using Azul.Core.GameAggregate;
using Azul.Core.Tests.Extensions;
using Azul.Core.TileFactoryAggregate.Contracts;
using Azul.Core.UserAggregate;
using Guts.Client.Core;

namespace Azul.Api.Tests;

[ProjectComponentTestFixture("1TINProject", "Azul", "GamesIntegration",
    @"Azul.Api\Controllers\GamesController.cs;
Azul.Core\GameAggregate\GameService.cs;
Azul.Core\GameAggregate\GameFactory.cs;
Azul.Core\GameAggregate\Game.cs;")]
public class GamesControllerIntegrationTests : ControllerIntegrationTestsBase<GamesController>
{
    [MonitoredTest]
    public void _01_GetGame_JustAfterCreation_ShouldReturnAGameWithACorrectStartSituation()
    {
        TableModel table = StartANewGameForANewTable();

        GameModel? game = GetGame(ClientA, table.GameId);
        Assert.That(game!.Id, Is.EqualTo(table.GameId), "The returned game has an incorrect Id");
        Assert.That(game.HasEnded, Is.False, "The game should not have ended yet (HasEnded)");
        Assert.That(game.RoundNumber, Is.EqualTo(1), "The game should be in round 1");

        //Players
        Assert.That(game.Players.Length, Is.EqualTo(2), "The game should have 2 players");
        Assert.That(game.PlayerToPlayId, Is.EqualTo(PlayerBAccessPass.User.Id),
            "Player B should be the player that must start the game because player A has not been in Portugal yet");

        var playerA = AssertIsValidPlayer(PlayerAAccessPass.User, game);
        Assert.That(playerA!.HasStartingTile, Is.False, $"Player '{playerA.Name}' should not have the starting tile");

        var playerB = AssertIsValidPlayer(PlayerBAccessPass.User, game);
        Assert.That(playerB!.HasStartingTile, Is.False, $"Player '{playerB.Name}' should not have the starting tile (starting tile should be in the table center");

        //Tile factory
        Assert.That(game.TileFactory, Is.Not.Null, "The game should have a tile factory");
        Assert.That(game.TileFactory.TableCenter, Is.Not.Null, "The tile factory should have a center of the table");
        Assert.That(game.TileFactory.TableCenter.Tiles, Has.One.EqualTo(TileType.StartingTile), "The center of the table should have the starting tile");
        Assert.That(game.TileFactory.Displays.Count, Is.EqualTo(5), "The tile factory should have 5 factory displays");
        Assert.That(game.TileFactory.Displays.All(d => d.Tiles.Count == 4), Is.True, "Each factory display should have 4 tiles");
        Assert.That(game.TileFactory.IsEmpty, Is.False, "IsEmpty of the the tile factory should return false");
    }

    [MonitoredTest]
    public void _02_TakeTiles_ItIsNotYourTurn_ShouldReturn_400_BadRequest()
    {
        TableModel table = StartANewGameForANewTable();

        //Get game for user A
        GameModel? game = GetGame(ClientA, table.GameId);
        Assert.That(game!.Id, Is.EqualTo(table.GameId), "Error retrieving the game.\n The returned game has an incorrect Id");

        PlayerModel? playerThatMustWait = game.Players.FirstOrDefault(p => p.Id != game.PlayerToPlayId);
        Assert.That(playerThatMustWait, Is.Not.Null, "Cannot find a player that must wait for other player to play");

        FactoryDisplayModel displayToTakeTilesFrom = game.TileFactory.Displays.First();
        Assert.That(displayToTakeTilesFrom.Tiles.Count, Is.GreaterThan(0), "The display should have tiles");
        TileType tileTypeToTake = displayToTakeTilesFrom.Tiles.First();
        HttpResponseMessage result = TakeTiles(game, playerThatMustWait!, displayToTakeTilesFrom, tileTypeToTake);
        Assert.That(result.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "The response status code should be 400 (BadRequest)");
        ErrorModel? error = result.Content.ReadFromJsonAsync<ErrorModel>(JsonSerializerOptions).Result;
        Assert.That(error, Is.Not.Null, "The response should contain an error message (ErrorModel)");
    }

    [MonitoredTest]
    public void _03_TakeTiles_TileTypeIsNotInFactoryDisplay_ShouldReturn_400_BadRequest()
    {
        TableModel table = StartANewGameForANewTable();

        //Get game for user A
        GameModel? game = GetGame(ClientA, table.GameId);
        Assert.That(game!.Id, Is.EqualTo(table.GameId), "Error retrieving the game.\n The returned game has an incorrect Id");

        PlayerModel? playerToPlay = game.Players.FirstOrDefault(p => p.Id == game.PlayerToPlayId);
        Assert.That(playerToPlay, Is.Not.Null,
            $"Player to play '{game.PlayerToPlayId}' not found in the game model retrieved from the Api");

        FactoryDisplayModel displayToTakeTilesFrom = game.TileFactory.Displays.First();
        Assert.That(displayToTakeTilesFrom.Tiles.Count, Is.GreaterThan(0), "The display should have tiles");
        TileType tileTypeNotInDisplay = Enum.GetValues<TileType>().First(t => !displayToTakeTilesFrom.Tiles.Contains(t));
        HttpResponseMessage result = TakeTiles(game, playerToPlay!, displayToTakeTilesFrom, tileTypeNotInDisplay);
        Assert.That(result.StatusCode, Is.EqualTo(HttpStatusCode.BadRequest), "The response status code should be 400 (BadRequest)");
        ErrorModel? error = result.Content.ReadFromJsonAsync<ErrorModel>(JsonSerializerOptions).Result;
        Assert.That(error, Is.Not.Null, "The response should contain an error message (ErrorModel)");
    }

    [MonitoredTest]
    public void _04_TakeTilesFromDisplay_ShouldTakeAllTilesOfType_ShouldMoveTakenTilesToPlayer_ShouldMoveOtherTilesToTableCenter()
    {
        TableModel table = StartANewGameForANewTable();

        //Get game for user A
        GameModel? game = GetGame(ClientA, table.GameId);
        Assert.That(game!.Id, Is.EqualTo(table.GameId), "Error retrieving the game.\n The returned game has an incorrect Id");

        PlayerModel? playerToPlay = game.Players.FirstOrDefault(p => p.Id == game.PlayerToPlayId);
        Assert.That(playerToPlay, Is.Not.Null,
            $"Player to play '{game.PlayerToPlayId}' not found in the game model retrieved from the Api");

        FactoryDisplayModel displayToTakeTilesFrom = Random.Shared.NextItem(game.TileFactory.Displays);
        Assert.That(displayToTakeTilesFrom.Tiles.Count, Is.GreaterThan(0), "The display should have tiles");
        TileType tileTypeToTake = Random.Shared.NextItem(displayToTakeTilesFrom.Tiles);

        List<TileType> expectedTakenTiles = displayToTakeTilesFrom.Tiles.Where(t => t == tileTypeToTake).ToList();
        List<TileType> expectedRemainingTiles = displayToTakeTilesFrom.Tiles.Where(t => t != tileTypeToTake).ToList();

        HttpResponseMessage result = TakeTiles(game, playerToPlay!, displayToTakeTilesFrom, tileTypeToTake);

        ErrorModel? error = null;
        if (!result.IsSuccessStatusCode)
        {
            error = result.Content.ReadFromJsonAsync<ErrorModel>(JsonSerializerOptions).Result;
        }
        Assert.That(result.StatusCode, Is.EqualTo(HttpStatusCode.OK), $"Error taking tiles. {error?.Message}");

        //Check game status after taking tiles
        GameModel? modifiedGame = GetGame(ClientA, game.Id);
        Assert.That(modifiedGame!.Id, Is.EqualTo(table.GameId), "Error retrieving the game.\n The returned game has an incorrect Id");

        // Display should not contain tiles of the type that was taken
        FactoryDisplayModel? modifiedDisplay = modifiedGame.TileFactory.Displays.FirstOrDefault(d => d.Id == displayToTakeTilesFrom.Id);
        Assert.That(modifiedDisplay, Is.Not.Null, $"The display with id {displayToTakeTilesFrom.Id} should still exist in the game");
        Assert.That(modifiedDisplay!.Tiles, Has.Count.Zero,
            "The display should not contain any tiles anymore");

        // Player should have the taken tiles
        PlayerModel? modifiedPlayer = modifiedGame.Players.FirstOrDefault(p => p.Id == playerToPlay!.Id);
        Assert.That(modifiedPlayer, Is.Not.Null, $"Player '{playerToPlay!.Name}' not found in the game model retrieved from the Api");
        Assert.That(modifiedPlayer!.TilesToPlace, Is.EquivalentTo(expectedTakenTiles),
            $"Player '{playerToPlay.Name}' should have the taken tile in the list of tiles to place");

        // Table center should contain the tiles that were not taken
        bool takenTilesAreInTableCenter = expectedRemainingTiles.All(t => modifiedGame.TileFactory.TableCenter.Tiles.Contains(t));
        Assert.That(takenTilesAreInTableCenter, Is.True,
            "The table center should contain the tiles that were not taken");
    }

    [MonitoredTest]
    public void _05_TakeTilesFromTableCenter_ShouldTakeAllTilesOfType_ShouldMoveTakenTilesToPlayer_ShouldTakeStartingTile()
    {
        TableModel table = StartANewGameForANewTable();

        //Get game for user A
        GameModel? game = GetGame(ClientA, table.GameId);
        Assert.That(game!.Id, Is.EqualTo(table.GameId), "Error retrieving the game.\n The returned game has an incorrect Id");

        PlayerModel? playerToPlay = game.Players.FirstOrDefault(p => p.Id == game.PlayerToPlayId);
        Assert.That(playerToPlay, Is.Not.Null,
            $"Player to play '{game.PlayerToPlayId}' not found in the game model retrieved from the Api");

        TileType tileTypeToTake = Random.Shared.NextItem(game.TileFactory.TableCenter.Tiles);

        List<TileType> expectedTakenTiles = game.TileFactory.TableCenter.Tiles.Where(t => t == tileTypeToTake).ToList();
        List<TileType> expectedRemainingTiles = game.TileFactory.TableCenter.Tiles.Where(t => t != tileTypeToTake && t != TileType.StartingTile).ToList();

        HttpResponseMessage result = TakeTiles(game, playerToPlay!, game.TileFactory.TableCenter, tileTypeToTake);

        ErrorModel? error = null;
        if (!result.IsSuccessStatusCode)
        {
            error = result.Content.ReadFromJsonAsync<ErrorModel>(JsonSerializerOptions).Result;
        }
        Assert.That(result.StatusCode, Is.EqualTo(HttpStatusCode.OK), $"Error taking tiles. {error?.Message}");

        //Check game status after taking tiles
        GameModel? modifiedGame = GetGame(ClientA, game.Id);
        Assert.That(modifiedGame!.Id, Is.EqualTo(table.GameId), "Error retrieving the game.\n The returned game has an incorrect Id");

        // Table center should not contain tiles of the type that was taken
        TableCenterModel modifiedTableCenter = modifiedGame.TileFactory.TableCenter;
        Assert.That(modifiedTableCenter.Tiles, Has.None.EqualTo(tileTypeToTake),
            "The table center should not contain the taken tile anymore");

        // Table center should not contain the starting tile
        Assert.That(modifiedTableCenter.Tiles, Has.None.EqualTo(TileType.StartingTile),
            "The table center should not contain the starting tile anymore");

        // Player should have the taken tiles
        PlayerModel? modifiedPlayer = modifiedGame.Players.FirstOrDefault(p => p.Id == playerToPlay!.Id);
        Assert.That(modifiedPlayer, Is.Not.Null, $"Player '{playerToPlay!.Name}' not found in the game model retrieved from the Api");
        Assert.That(modifiedPlayer!.TilesToPlace, Is.EquivalentTo(expectedTakenTiles),
            $"Player '{playerToPlay.Name}' should have the taken tile in the list of tiles to place");

        // Player should have the starting tile
        Assert.That(modifiedPlayer.HasStartingTile, Is.True, $"Player '{playerToPlay.Name}' should have the starting tile");
        var otherPlayer = modifiedGame.Players.FirstOrDefault(p => p.Id != modifiedPlayer.Id);
        Assert.That(otherPlayer!.HasStartingTile, Is.False, $"Other player should not have the starting tile");
    }

    [MonitoredTest]
    public void _06_SimulateWholeGame_SemiIntelligentArtificialPlayers_ShouldEndGameInLessThan100Turns()
    {
        TableModel table = StartANewGameForANewTable();

        //Get game for user A
        GameModel? game = GetGame(ClientA, table.GameId);
        Assert.That(game!.Id, Is.EqualTo(table.GameId), "Error retrieving the game.\n The returned game has an incorrect Id");

        TestContext.Out.WriteLine($"New round '{game.RoundNumber}'.");
        int turnCount = 0;
        while (turnCount < 100 && !game.HasEnded)
        {
            game = TakeRandomTilesFromFactory(game, out bool hasTakenLastTilesFromFactory);
            game = PlaceTiles(game, hasTakenLastTilesFromFactory);
            turnCount++;
        }

        string gameJson = JsonSerializer.Serialize(game, JsonSerializerOptions);

        Assert.That(game.HasEnded, Is.True, $"The game did not end after {turnCount} player turns.\n\nGame(json):\n{gameJson}");

        foreach (PlayerModel player in game.Players)
        {
            Assert.That(player.Board.Score, Is.GreaterThanOrEqualTo(0), $"Player '{player.Name}' should have a zero or positive score");
        }

        Assert.Pass($"Game ended after {turnCount} player turns:\n\nGame(json):\n{gameJson}");
    }

    private PlayerModel AssertIsValidPlayer(UserModel user, GameModel game)
    {
        var player = game.Players.FirstOrDefault(p => p.Id == user.Id);
        Assert.That(player, Is.Not.Null, $"Player for user '{user.UserName}' not found in the game");

        string playerName = player!.Name;
        Assert.That(playerName, Is.EqualTo(user.UserName), $"The name of the player should be the user name ({user.UserName})");
        Assert.That(player.Board, Is.Not.Null, $"Player '{playerName}' should have a board");
        Assert.That(player.TilesToPlace, Is.Not.Null, $"Player '{playerName}' should have a list to hold tiles to place");
        Assert.That(player.TilesToPlace.Count, Is.EqualTo(0), $"Player '{playerName}' should not have any tiles to place");
        Assert.That(player.LastVisitToPortugal, Is.EqualTo(user.LastVisitToPortugal),
            $"The last visit to Portugal of player '{playerName}' should be the same as the last visit to Portugal of user '{user.UserName}'");

        //Pattern lines
        Assert.That(player.Board.PatternLines.Length, Is.EqualTo(5), $"Player '{playerName}' should have 5 pattern lines");
        for (int expectedPatternLineLength = 1; expectedPatternLineLength <= 5; expectedPatternLineLength++)
        {
            Assert.That(player.Board.PatternLines.Count(pl => pl.Length == expectedPatternLineLength), Is.EqualTo(1),
                $"Player '{playerName}' should have 1 pattern line with a length of {expectedPatternLineLength}");
        }
        Assert.That(player.Board.PatternLines.All(pl => pl.NumberOfTiles == 0), Is.True, $"All pattern lines of player '{playerName}' should be empty");

        //Wall
        Assert.That(player.Board.Wall.GetLength(0), Is.EqualTo(5), $"The wall of player '{playerName}' should have 5 rows");
        Assert.That(player.Board.Wall.GetLength(1), Is.EqualTo(5), $"The wall of player '{playerName}' should have 5 columns");
        for (int i = 0; i < player.Board.Wall.GetLength(0); i++)
        {
            for (int j = 0; j < player.Board.Wall.GetLength(1); j++)
            {
                Assert.That(player.Board.Wall[i, j].HasTile, Is.False, $"All tile spots of the wall of player '{playerName}' should be empty");
            }
        }

        //Floor line
        Assert.That(player.Board.FloorLine.Length, Is.EqualTo(7), $"The floor line of player '{playerName}' should have 7 tile spots");
        Assert.That(player.Board.FloorLine.All(ts => ts.HasTile == false), Is.True, $"All tile spots of the floor line of player '{playerName}' should be empty");

        return player;
    }

    private GameModel TakeRandomTilesFromFactory(GameModel game, out bool hasTakenLastTilesFromFactory)
    {
        PlayerModel? playerToPlay = game.Players.FirstOrDefault(p => p.Id == game.PlayerToPlayId);
        Assert.That(playerToPlay, Is.Not.Null,
            $"Player to play '{game.PlayerToPlayId}' not found in the game model retrieved from the Api");
        HttpClient clientToPlay = playerToPlay.Id == PlayerAAccessPass.User.Id ? ClientA : ClientB;

        //Choose a display to pick tiles from
        List<FactoryDisplayModel> displaysToChooseFrom = game.TileFactory.Displays.Where(d => d.Tiles.Any()).ToList();
        if (game.TileFactory.TableCenter.Tiles.Count(t => t != TileType.StartingTile) > 0)
        {
            displaysToChooseFrom.Add(game.TileFactory.TableCenter);
        }

        int displayIndex = Random.Shared.Next(0, displaysToChooseFrom.Count);
        FactoryDisplayModel displayToTakeTilesFrom = displaysToChooseFrom[displayIndex];

        //Choose the tile type that is most abundant in the display
        TileType tileTypeToTake = displayToTakeTilesFrom.Tiles.Where(t => t != TileType.StartingTile).GroupBy(t => t).OrderByDescending(g => g.Count()).First().Key;

        int totalNumberOfTiles = game.TileFactory.Displays.Sum(d => d.Tiles.Count) + game.TileFactory.TableCenter.Tiles.Count;
        int numberOfTilesToBeTaken = displayToTakeTilesFrom.Tiles.Count(t => t == tileTypeToTake);
        hasTakenLastTilesFromFactory = totalNumberOfTiles - numberOfTilesToBeTaken == 0;

        HttpResponseMessage result = TakeTiles(game, playerToPlay, displayToTakeTilesFrom, tileTypeToTake);
        ErrorModel? error = null;
        if (!result.IsSuccessStatusCode)
        {
            error = result.Content.ReadFromJsonAsync<ErrorModel>(JsonSerializerOptions).Result;
        }
        Assert.That(result.StatusCode, Is.EqualTo(HttpStatusCode.OK), $"Error taking tiles. {error?.Message}");

        GameModel? modifiedGame = GetGame(clientToPlay, game.Id);
        Assert.That(modifiedGame!.PlayerToPlayId, Is.EqualTo(game.PlayerToPlayId), "Player to play should not change after taking tiles (the player has to place them)");
        return modifiedGame;
    }

    private HttpResponseMessage TakeTiles(GameModel game, PlayerModel playerToPlay, FactoryDisplayModel displayToTakeTilesFrom,
        TileType tileTypeToTake)
    {
        HttpClient clientToPlay = playerToPlay.Id == PlayerAAccessPass.User.Id ? ClientA : ClientB;
        string displayName = displayToTakeTilesFrom.Id == game.TileFactory.TableCenter.Id
            ? "Table center"
            : displayToTakeTilesFrom.Id.ToString();
        int numberOfTilesToBeTaken = displayToTakeTilesFrom.Tiles.Count(t => t == tileTypeToTake);
        TestContext.Out.WriteLine(
            $"'{playerToPlay.Name}' - " +
            $"Taking {numberOfTilesToBeTaken} tiles '{tileTypeToTake}' from display '{displayName}'");
        HttpResponseMessage result = clientToPlay.PostAsJsonAsync($"api/games/{game.Id}/take-tiles", new TakeTilesModel
        {
            DisplayId = displayToTakeTilesFrom.Id,
            TileType = tileTypeToTake
        }).Result;

        return result;
    }

    private GameModel PlaceTiles(GameModel game, bool hasTakenLastTilesFromFactory)
    {
        PlayerModel? playerToPlay = game.Players.FirstOrDefault(p => p.Id == game.PlayerToPlayId);
        Assert.That(playerToPlay, Is.Not.Null,
            $"Player to play '{game.PlayerToPlayId}' not found in the game model retrieved from the Api");
        HttpClient clientToPlay = playerToPlay.Id == PlayerAAccessPass.User.Id ? ClientA : ClientB;

        Assert.That(playerToPlay.TilesToPlace.Count, Is.GreaterThan(0), $"Player '{playerToPlay.Name}' should have tiles to place");
        var originalTilesToPlace = new List<TileType>(playerToPlay.TilesToPlace);
        TileType tileType = playerToPlay.TilesToPlace.First(t => t != TileType.StartingTile);
        int numberOfTilesToPlace = playerToPlay.TilesToPlace.Count(t => t == tileType);

        //Check if the tiles can be placed on a pattern line.
        var query = from patternLine in playerToPlay.Board.PatternLines
                    let remainingSpots = patternLine.Length - patternLine.NumberOfTiles
                    let remainingSpotsBonus = Math.Max(0, remainingSpots - 2)
                    let alreadyPlacedTilesBonus = patternLine.NumberOfTiles > 0 ? 2 : 0
                    let toFloorCountPenalty = Math.Max(0, numberOfTilesToPlace - remainingSpots) * 3
                    let completionBonus = (remainingSpots - numberOfTilesToPlace) == 0 ? 2 : 0
                    let score = remainingSpotsBonus + alreadyPlacedTilesBonus + completionBonus - toFloorCountPenalty
                    where (patternLine.TileType == tileType || patternLine.NumberOfTiles == 0) &&
                  !patternLine.IsComplete &&
                  FindTileInWall(playerToPlay.Board, patternLine.Length - 1, tileType).HasTile == false
                    orderby score descending
                    select new
                    {
                        score,
                        patternLine
                    };
        var candidatePatterLinesWithScore = query.ToList();
        if (candidatePatterLinesWithScore.Any())
        {
            List<PatternLineModel> candidatePatternLines = candidatePatterLinesWithScore
                .GroupBy(pl => pl.score)
                .MaxBy(g => g.Key)!
                .Select(pl => pl.patternLine)
                .ToList();
            PatternLineModel targetPatternLine = Random.Shared.NextItem(candidatePatternLines);
            TestContext.Out.WriteLine(
                $"'{playerToPlay.Name}' - " +
                $"Placing {string.Join(", ", playerToPlay.TilesToPlace)}' in pattern line of length '{targetPatternLine.Length}'");
            HttpResponseMessage? result = clientToPlay.PostAsJsonAsync($"api/games/{game.Id}/place-tiles-on-patternline", new PlaceTilesModel
            {
                PatternLineIndex = targetPatternLine.Length - 1
            }).Result;

            ErrorModel? error = null;
            if (!result.IsSuccessStatusCode)
            {
                error = result.Content.ReadFromJsonAsync<ErrorModel>(JsonSerializerOptions).Result;
            }
            Assert.That(result.StatusCode, Is.EqualTo(HttpStatusCode.OK), $"Error placing tiles. {error?.Message}");
        }
        else
        {
            //add to floor line
            TestContext.Out.WriteLine(
                $"'{playerToPlay.Name}' - " +
                $"Placing tiles of type '{tileType}' on the floor line");
            HttpResponseMessage? result = clientToPlay.PostAsJsonAsync($"api/games/{game.Id}/place-tiles-on-floorline", new { }).Result;

            ErrorModel? error = null;
            if (!result.IsSuccessStatusCode)
            {
                error = result.Content.ReadFromJsonAsync<ErrorModel>(JsonSerializerOptions).Result;
            }
            Assert.That(result.StatusCode, Is.EqualTo(HttpStatusCode.OK), $"Error placing tiles on floor line. {error?.Message}");
        }

        GameModel? modifiedGame = GetGame(clientToPlay, game.Id);
        PlayerModel modifiedPlayer = modifiedGame.Players.First(p => p.Id == playerToPlay.Id);
        PlayerModel otherPlayer = modifiedGame.Players.First(p => p.Id != playerToPlay.Id);

        Assert.That(modifiedPlayer.TilesToPlace, Has.Count.Zero, $"After placing tiles, the 'TilesToPlace' of the player should be empty");

        if (hasTakenLastTilesFromFactory)
        {
            TestContext.Out.WriteLine("Round ended");
            foreach (PlayerModel player in modifiedGame.Players)
            {
                TestContext.Out.WriteLine($"Score of player '{player.Name}': {player.Board.Score}");
            }

            if (!modifiedGame.HasEnded)
            {
                TestContext.Out.WriteLine($"New round '{modifiedGame.RoundNumber}'.");

                //Player to play should be the player that was holding the starting tile
                PlayerModel? playerThatWasHoldingStartingTile = game.Players.FirstOrDefault(p => p.HasStartingTile);
                if (playerThatWasHoldingStartingTile is null && originalTilesToPlace.Contains(TileType.StartingTile))
                {
                    playerThatWasHoldingStartingTile = playerToPlay;
                }

                Assert.That(playerThatWasHoldingStartingTile, Is.Not.Null,
                    "No player found that was holding the starting tile at the end of the round");

                Assert.That(modifiedGame.PlayerToPlayId, Is.EqualTo(playerThatWasHoldingStartingTile!.Id),
                    $"After placing tiles, when the round has ended, the turn (player to play) should go to the player that was holding the starting tile");

                Assert.That(modifiedGame.TileFactory.TableCenter.Tiles, Has.One.EqualTo(TileType.StartingTile),
                    "After placing tiles, when a new round has started, the table center should have the starting tile");
                Assert.That(modifiedGame.Players.All(p => !p.HasStartingTile), Is.True,
                    "After placing tiles, when a new round has started, no player should have the starting tile anymore (it is now in the table center)");
            }
        }
        else
        {
            Assert.That(modifiedGame.PlayerToPlayId, Is.EqualTo(otherPlayer.Id),
                $"After placing tiles, when the round has not ended yet, the turn (player to play) should go to the other player");
        }
        return modifiedGame;
    }

    private TileSpotModel FindTileInWall(BoardModel board, int rowIndex, TileType tileType)
    {
        for (int i = 0; i < 5; i++)
        {
            if (board.Wall[rowIndex, i].Type == tileType)
            {
                return board.Wall[rowIndex, i];
            }
        }
        throw new AssertionException($"Tile of type '{tileType}' not found in the wall of player on row with index {rowIndex}");
    }

    private GameModel GetGame(HttpClient client, Guid gameId)
    {
        var result = client.GetAsync($"api/games/{gameId}").Result;
        ErrorModel? error = null;
        if (!result.IsSuccessStatusCode)
        {
            error = result.Content.ReadFromJsonAsync<ErrorModel>(JsonSerializerOptions).Result;
        }
        Assert.That(result.StatusCode, Is.EqualTo(HttpStatusCode.OK),
        $"Error retrieving the game with id '{gameId}'.\n {error?.Message}");

        GameModel? gameModel = result.Content.ReadFromJsonAsync<GameModel>(JsonSerializerOptions).Result;
        Assert.That(gameModel, Is.Not.Null, $"Error retrieving the game with id '{gameId}'.\n Game not found in Api response");
        return gameModel!;
    }
}