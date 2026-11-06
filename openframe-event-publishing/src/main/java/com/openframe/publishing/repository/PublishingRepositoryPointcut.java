package com.openframe.publishing.repository;

import org.springframework.aop.support.StaticMethodMatcherPointcut;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.data.core.PropertyReferenceException;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.repository.core.RepositoryInformation;
import org.springframework.data.repository.query.parser.PartTree;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

// The methods PublishingRepositoryInterceptor publishes: those marked on PublishedRepositoryWrites, and the repository's derived deletes.
class PublishingRepositoryPointcut extends StaticMethodMatcherPointcut {

    // By signature, not Method: a caller holding the repository as CrudRepository calls CrudRepository.save, not our redeclaration.
    private static final Map<String, PublishedWrite> BASE_WRITES = baseWrites();

    private final Set<String> derivedDeletes;
    // Classified once per method, because the interceptor asks on every call.
    private final Map<Method, PublishedWrite> writes = new ConcurrentHashMap<>();

    private PublishingRepositoryPointcut(Set<String> derivedDeletes) {
        this.derivedDeletes = derivedDeletes;
    }

    static PublishingRepositoryPointcut of(RepositoryInformation information) {
        Class<?> domainType = information.getDomainType();
        Set<String> derivedDeletes = information.getQueryMethods().stream()
                .filter(method -> isDerivedDelete(method, domainType))
                .map(PublishingRepositoryPointcut::signatureOf)
                .collect(Collectors.toUnmodifiableSet());
        return new PublishingRepositoryPointcut(derivedDeletes);
    }

    @Override
    public boolean matches(Method method, Class<?> targetClass) {
        PublishedWrite write = writeOf(method);
        return write != PublishedWrite.NONE;
    }

    PublishedWrite writeOf(Method method) {
        return writes.computeIfAbsent(method, this::classify);
    }

    // Spring Data's own rule: a @Query(delete = true), or a derived query whose name parses as a delete.
    static boolean isDerivedDelete(Method method, Class<?> domainType) {
        Query query = AnnotatedElementUtils.findMergedAnnotation(method, Query.class);
        if (query != null) {
            return query.delete();
        }
        try {
            String name = method.getName();
            return new PartTree(name, domainType).isDelete();
        } catch (PropertyReferenceException notDerived) {
            return false;
        }
    }

    private PublishedWrite classify(Method method) {
        String signature = signatureOf(method);
        if (derivedDeletes.contains(signature)) {
            return PublishedWrite.DERIVED_DELETE;
        }
        return BASE_WRITES.getOrDefault(signature, PublishedWrite.NONE);
    }

    private static Map<String, PublishedWrite> baseWrites() {
        Map<String, PublishedWrite> writes = new HashMap<>();
        for (Method method : PublishedRepositoryWrites.class.getDeclaredMethods()) {
            String signature = signatureOf(method);
            PublishesDelete delete = method.getAnnotation(PublishesDelete.class);
            if (method.isAnnotationPresent(PublishesChange.class)) {
                writes.put(signature, PublishedWrite.CHANGE);
            } else if (delete != null) {
                PublishedWrite deleteWrite = delete.value();
                writes.put(signature, deleteWrite);
            }
        }
        return Map.copyOf(writes);
    }

    private static String signatureOf(Method method) {
        Class<?>[] parameterTypes = method.getParameterTypes();
        return method.getName() + Arrays.toString(parameterTypes);
    }
}
