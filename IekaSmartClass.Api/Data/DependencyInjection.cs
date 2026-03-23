using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using IekaSmartClass.Api.Data.Repositories.Interface;
using IekaSmartClass.Api.Data.Repositories;

namespace IekaSmartClass.Api.Data;

public static class DependencyInjection
{
    public static IServiceCollection AddData(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer(connectionString));

        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        return services;
    }
}
