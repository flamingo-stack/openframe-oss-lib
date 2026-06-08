package com.openframe.data.mongo;

import com.openframe.data.document.TenantScoped;
import com.openframe.data.service.TenantIdProvider;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.core.ExecutableFindOperation;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.convert.MongoConverter;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.CriteriaDefinition;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.UpdateDefinition;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.UpdateResult;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.stream.Stream;

public class TenantAwareMongoTemplate extends MongoTemplate {

    private final TenantIdProvider tenantIdProvider;

    public TenantAwareMongoTemplate(MongoDatabaseFactory mongoDbFactory,
                                     MongoConverter mongoConverter,
                                     TenantIdProvider tenantIdProvider) {
        super(mongoDbFactory, mongoConverter);
        this.tenantIdProvider = tenantIdProvider;
    }

    /** Current pod's tenantId — use in composite keys and aggregation match stages. */
    public String tenantId() {
        return tenantIdProvider.getTenantId();
    }

    /** Call this from aggregation pipelines: mongoTemplate.tenantCriteria() */
    public Criteria tenantCriteria() {
        return Criteria.where("tenantId").is(tenantIdProvider.getTenantId());
    }

    /**
     * Override the fluent query entry point used by Spring Data MongoDB 4.x derived queries.
     * AbstractMongoQuery stores the result of operations.query(type) at construction time and
     * uses find.matching(query).all() for execution — bypassing find(Query, Class, String).
     * By wrapping the returned ExecutableFind, we ensure tenantId is injected into every query.
     */
    @Override
    @SuppressWarnings("unchecked")
    public <T> ExecutableFindOperation.ExecutableFind<T> query(Class<T> domainType) {
        ExecutableFindOperation.ExecutableFind<T> delegate = super.query(domainType);
        if (domainType == null || !TenantScoped.class.isAssignableFrom(domainType)) {
            return delegate;
        }
        return (ExecutableFindOperation.ExecutableFind<T>) Proxy.newProxyInstance(
                delegate.getClass().getClassLoader(),
                getInterfaces(delegate.getClass()),
                new TenantScopedFindHandler<>(delegate, this)
        );
    }

    private static Class<?>[] getInterfaces(Class<?> clazz) {
        // Collect all interfaces the delegate implements for the proxy
        java.util.Set<Class<?>> interfaces = new java.util.LinkedHashSet<>();
        Class<?> current = clazz;
        while (current != null) {
            for (Class<?> iface : current.getInterfaces()) {
                interfaces.add(iface);
            }
            current = current.getSuperclass();
        }
        if (interfaces.isEmpty()) {
            interfaces.add(ExecutableFindOperation.ExecutableFind.class);
        }
        return interfaces.toArray(new Class[0]);
    }

    private static class TenantScopedFindHandler<T> implements InvocationHandler {
        private final Object delegate;
        private final TenantAwareMongoTemplate template;

        TenantScopedFindHandler(Object delegate, TenantAwareMongoTemplate template) {
            this.delegate = delegate;
            this.template = template;
        }

        @Override
        @SuppressWarnings("unchecked")
        public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            // Intercept matching(Query) to inject tenantId
            if ("matching".equals(method.getName()) && args != null && args.length == 1
                    && args[0] instanceof Query query) {
                if (!query.getQueryObject().containsKey("tenantId")) {
                    query.addCriteria(Criteria.where("tenantId").is(template.tenantId()));
                }
                return method.invoke(delegate, args);
            }
            Object result = method.invoke(delegate, args);
            // Wrap as() and inCollection() results so matching() on them is also intercepted
            if (result != null && ("as".equals(method.getName()) || "inCollection".equals(method.getName()))) {
                result = Proxy.newProxyInstance(
                        result.getClass().getClassLoader(),
                        getInterfaces(result.getClass()),
                        new TenantScopedFindHandler<>(result, template)
                );
            }
            return result;
        }
    }

    protected Query scope(Query query, Class<?> entityClass) {
        if (entityClass != null
                && TenantScoped.class.isAssignableFrom(entityClass)
                && !query.getQueryObject().containsKey("tenantId")) {
            query.addCriteria(Criteria.where("tenantId").is(tenantIdProvider.getTenantId()));
        }
        return query;
    }

    @Override
    public <T> List<T> find(Query query, Class<T> entityClass) {
        return super.find(scope(query, entityClass), entityClass);
    }

    @Override
    public <T> List<T> find(Query query, Class<T> entityClass, String collectionName) {
        return super.find(scope(query, entityClass), entityClass, collectionName);
    }

    @Override
    public <T> T findOne(Query query, Class<T> entityClass) {
        return super.findOne(scope(query, entityClass), entityClass);
    }

    @Override
    public <T> T findOne(Query query, Class<T> entityClass, String collectionName) {
        return super.findOne(scope(query, entityClass), entityClass, collectionName);
    }

    @Override
    public long count(Query query, Class<?> entityClass) {
        return super.count(scope(query, entityClass), entityClass);
    }

    @Override
    public long count(Query query, Class<?> entityClass, String collectionName) {
        return super.count(scope(query, entityClass), entityClass, collectionName);
    }

    @Override
    public boolean exists(Query query, Class<?> entityClass) {
        return super.exists(scope(query, entityClass), entityClass);
    }

    @Override
    public boolean exists(Query query, Class<?> entityClass, String collectionName) {
        return super.exists(scope(query, entityClass), entityClass, collectionName);
    }

    @Override
    public <T> Stream<T> stream(Query query, Class<T> entityClass) {
        return super.stream(scope(query, entityClass), entityClass);
    }

    @Override
    public <T> Stream<T> stream(Query query, Class<T> entityClass, String collectionName) {
        return super.stream(scope(query, entityClass), entityClass, collectionName);
    }

    @Override
    public UpdateResult updateFirst(Query query, UpdateDefinition update, Class<?> entityClass) {
        return super.updateFirst(scope(query, entityClass), update, entityClass);
    }

    @Override
    public UpdateResult updateFirst(Query query, UpdateDefinition update, Class<?> entityClass, String collectionName) {
        return super.updateFirst(scope(query, entityClass), update, entityClass, collectionName);
    }

    @Override
    public UpdateResult updateMulti(Query query, UpdateDefinition update, Class<?> entityClass) {
        return super.updateMulti(scope(query, entityClass), update, entityClass);
    }

    @Override
    public UpdateResult updateMulti(Query query, UpdateDefinition update, Class<?> entityClass, String collectionName) {
        return super.updateMulti(scope(query, entityClass), update, entityClass, collectionName);
    }

    @Override
    public UpdateResult upsert(Query query, UpdateDefinition update, Class<?> entityClass) {
        return super.upsert(scope(query, entityClass), update, entityClass);
    }

    @Override
    public UpdateResult upsert(Query query, UpdateDefinition update, Class<?> entityClass, String collectionName) {
        return super.upsert(scope(query, entityClass), update, entityClass, collectionName);
    }

    @Override
    public DeleteResult remove(Query query, Class<?> entityClass) {
        return super.remove(scope(query, entityClass), entityClass);
    }

    @Override
    public DeleteResult remove(Query query, Class<?> entityClass, String collectionName) {
        return super.remove(scope(query, entityClass), entityClass, collectionName);
    }

    @Override
    public <T> T findAndModify(Query query, UpdateDefinition update, FindAndModifyOptions options, Class<T> entityClass) {
        return super.findAndModify(scope(query, entityClass), update, options, entityClass);
    }

    @Override
    public <T> T findAndModify(Query query, UpdateDefinition update, FindAndModifyOptions options, Class<T> entityClass, String collectionName) {
        return super.findAndModify(scope(query, entityClass), update, options, entityClass, collectionName);
    }

    @Override
    public <T> T findAndRemove(Query query, Class<T> entityClass) {
        return super.findAndRemove(scope(query, entityClass), entityClass);
    }

    @Override
    public <T> T findAndRemove(Query query, Class<T> entityClass, String collectionName) {
        return super.findAndRemove(scope(query, entityClass), entityClass, collectionName);
    }
    // aggregate() intentionally NOT overridden — callers must add tenantId $match explicitly
}
