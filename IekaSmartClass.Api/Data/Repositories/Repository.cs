using Microsoft.EntityFrameworkCore;
using IekaSmartClass.Api.Data.Repositories.Interface;

namespace IekaSmartClass.Api.Data.Repositories;

public class Repository<T>(ApplicationDbContext dbContext) : IRepository<T> where T : class
{
    protected readonly ApplicationDbContext _dbContext = dbContext;

    public virtual async Task<T?> GetByIdAsync(Guid id) => await _dbContext.Set<T>().FindAsync(id);

    public async Task<IReadOnlyList<T>> GetAllAsync() => await _dbContext.Set<T>().ToListAsync();

    public IQueryable<T> Query() => _dbContext.Set<T>().AsQueryable();

    public async Task<T> AddAsync(T entity)
    {
        await _dbContext.Set<T>().AddAsync(entity);
        return entity;
    }

    public void Update(T entity) => _dbContext.Set<T>().Update(entity);

    public void Delete(T entity) => _dbContext.Set<T>().Remove(entity);
}
