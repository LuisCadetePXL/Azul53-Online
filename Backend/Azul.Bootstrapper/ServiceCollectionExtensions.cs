using Azul.Core.GameAggregate;
using Azul.Core.GameAggregate.Contracts;
using Azul.Core.PlayerAggregate;
using Azul.Core.PlayerAggregate.Contracts;
using Azul.Core.TableAggregate;
using Azul.Core.TableAggregate.Contracts;
using Azul.Core.UserAggregate;
using Azul.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Azul.Bootstrapper;

public static class ServiceCollectionExtensions
{
    public static void AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AzulDbContext>(options =>
        {
            string connectionString = configuration.GetConnectionString("AzulDbConnection")!;
            options.UseSqlServer(connectionString).EnableSensitiveDataLogging();
        });

        services.AddIdentity<User, IdentityRole<Guid>>(options =>
            {
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.MaxFailedAccessAttempts = 8;
                options.Lockout.AllowedForNewUsers = true;

                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequireDigit = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireLowercase = false;
                options.Password.RequiredLength = 5;

                options.SignIn.RequireConfirmedEmail = false;
                options.SignIn.RequireConfirmedPhoneNumber = false;

                options.User.RequireUniqueEmail = true;
            })
            .AddEntityFrameworkStores<AzulDbContext>()
            .AddDefaultTokenProviders();

        services.AddSingleton<ITableRepository, InMemoryTableRepository>();
        services.AddSingleton<IGameRepository, InMemoryGameRepository>();
    }

    public static void AddCore(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<ITableManager, TableManager>();
        services.AddSingleton<ITableFactory, TableFactory>();
        services.AddScoped<IGameFactory, GameFactory>();
        services.AddScoped<IGameService, GameService>();
        services.AddScoped<IGamePlayStrategy, GamePlayStrategy>();
    }
}

