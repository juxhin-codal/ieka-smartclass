using System.Security.Claims;
using IekaSmartClass.Api.Utilities.Context;

namespace IekaSmartClass.Api.Utilities.Context;

public class RequestContext(IHttpContextAccessor httpContextAccessor) : IRequestContext
{
    private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;

    public Guid? UserId
    {
        get
        {
            var idClaim = _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(idClaim, out var id) ? id : null;
        }
    }

    public string? UserRole => _httpContextAccessor.HttpContext?.User.FindFirst(ClaimTypes.Role)?.Value;

    public string? RegistryNumber => _httpContextAccessor.HttpContext?.User.FindFirst("RegistryNumber")?.Value;
}
