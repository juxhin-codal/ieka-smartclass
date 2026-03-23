using Microsoft.OpenApi.Models;

namespace IekaSmartClass.Api.Utilities.Extensions;

public static class SwaggerExtensions
{
    public static IServiceCollection AddSwaggerDocumentation(this IServiceCollection services)
    {
        services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new OpenApiInfo { Title = "IEKA SmartClass API", Version = "v1", Description = "API for IEKA Events Management" });
        });
        return services;
    }

    public static IApplicationBuilder UseSwaggerDocumentation(this IApplicationBuilder app)
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "IEKA SmartClass API v1");
        });
        return app;
    }
}
