using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;

namespace IekaSmartClass.Api.Utilities.Pagination;

public static class MappingExtensions
{
    public static Task<PaginatedList<TDestination>> PaginatedListAsync<TDestination>(this IQueryable<TDestination> queryable, int pageNumber, int pageSize) where TDestination : class
        => PaginatedList<TDestination>.CreateAsync(queryable.AsNoTracking(), pageNumber, pageSize);

    public static Task<PaginatedList<TDestination>> ProjectToPaginatedListAsync<TDestination>(this IQueryable<object> queryable, AutoMapper.IConfigurationProvider configuration, int pageNumber, int pageSize) where TDestination : class
        => queryable.ProjectTo<TDestination>(configuration).AsNoTracking().PaginatedListAsync(pageNumber, pageSize);
}
