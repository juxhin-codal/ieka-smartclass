using System.Linq.Expressions;

namespace IekaSmartClass.Api.Data.Repositories.Interface;

public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(Guid id);
    Task<IReadOnlyList<T>> GetAllAsync();
    IQueryable<T> Query();
    Task<T> AddAsync(T entity);
    void Update(T entity);
    void Delete(T entity);
}
