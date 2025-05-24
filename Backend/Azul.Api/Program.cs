
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.OpenApi.Models;
using System.Reflection;
using System.Text;
using Azul.Api.Models.Output;
using Azul.Core.UserAggregate;
using Azul.Api.Services;
using Azul.Api.Services.Contracts;
using Azul.Api.Util;
using Azul.Bootstrapper;
using Azul.Core.BoardAggregate;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Azul.Api.Chat;

namespace Azul.Api
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            ///////////////////////////////////
            // Dependency injection container//
            ///////////////////////////////////

            builder.Services.AddSingleton(provider =>
                new AzulExceptionFilterAttribute(provider.GetRequiredService<ILogger<Program>>()));

            builder.Services.AddControllers(options =>
            {
                var onlyAuthenticatedUsersPolicy = new AuthorizationPolicyBuilder(JwtBearerDefaults.AuthenticationScheme)
                    .RequireAuthenticatedUser().Build();
                options.Filters.Add(new AuthorizeFilter(onlyAuthenticatedUsersPolicy));
                options.Filters.AddService<AzulExceptionFilterAttribute>();
            }).AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.Converters.Add(new TwoDimensionalArrayJsonConverter<TileSpotModel>());
            });

            builder.Services.AddSignalR();

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowSpecificOrigin",
                    builder => builder
                        .WithOrigins("http://localhost:63342")
                        .AllowAnyHeader()
                        .AllowAnyMethod()
                        .AllowCredentials());
            });

            // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(options =>
            {
                options.SwaggerDoc("v1", new OpenApiInfo
                {
                    Version = "v1",
                    Title = "Azul API",
                    Description = "REST API for online Azul gameplay"
                });

                // Use XML documentation
                string xmlFilename = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml"; //api project
                options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFilename));

                xmlFilename = $"{typeof(User).Assembly.GetName().Name}.xml"; //core layer
                options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFilename));

                // Enable bearer token authentication
                options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme()
                {
                    Name = "Authorization",
                    Type = SecuritySchemeType.ApiKey,
                    Scheme = "Bearer",
                    BearerFormat = "JWT",
                    In = ParameterLocation.Header,
                    Description = "Copy 'Bearer ' + valid token into field. You can retrieve a bearer token via '/api/authentication/token'"
                });

                options.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference
                            {
                                Type = ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        },
                        new string[] {}
                    }
                });
            });

            IConfiguration configuration = builder.Configuration;
            var tokenSettings = new TokenSettings();
            configuration.Bind("Token", tokenSettings);

            builder.Services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                })
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidIssuer = tokenSettings.Issuer,
                        ValidAudience = tokenSettings.Audience,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(tokenSettings.Key)),
                    };
                });

            builder.Services.AddAuthorization();

            builder.Services.AddAutoMapper(typeof(Program));
            builder.Services.AddSingleton<ITokenFactory>(new JwtTokenFactory(tokenSettings));
            builder.Services.AddCore(configuration);
            builder.Services.AddInfrastructure(configuration);

            //////////////////////////////////////////////
            //Create database (if it does not exist yet)//
            //////////////////////////////////////////////

            var app = builder.Build();
            app.EnsureDatabaseIsCreated();

            ////////////////////////
            // Middleware pipeline//
            ////////////////////////

            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseCors("AllowSpecificOrigin");

            app.UseHttpsRedirection();

            app.UseAuthorization();

            app.MapHub<ChatHub>("/chathub");

            app.MapControllers();

            app.Run();
        }
    }
}
