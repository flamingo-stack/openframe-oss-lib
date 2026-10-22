package com.openframe.publishing.repository;

import com.openframe.publishing.api.PublishedDocuments;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.aop.Advisor;
import org.springframework.aop.framework.Advised;
import org.springframework.beans.factory.ListableBeanFactory;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.data.mongodb.repository.query.MongoEntityInformation;
import org.springframework.data.repository.core.EntityInformation;
import org.springframework.data.repository.core.RepositoryInformation;
import org.springframework.data.repository.core.support.RepositoryFactoryBeanSupport;
import org.springframework.data.repository.core.support.RepositoryFactoryInformation;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Stops the service at startup when a repository of a published document would publish wrongly or not at all.
 * A repository publishes when its document is the {@code D} of an {@link AggregateSpec}; for each such repository it checks that:
 * <ul>
 *   <li>one repository per published document class, and every spec's document has one; a subclass document, such as
 *       {@code AuthUser} of {@code User}, publishes with its parent's spec through its own repository;</li>
 *   <li>its document has a {@code @Version} field, because the version orders the events;</li>
 *   <li>{@link PublishingRepositoryInterceptor} is inside the repository's proxy;</li>
 *   <li>it has no {@code @Update} method, which returns no documents to publish;</li>
 *   <li>no derived delete returns a count instead of the deleted documents;</li>
 *   <li>no custom method carries {@link PublishesChange} or {@link PublishesDelete};</li>
 *   <li>every Spring Data write method is in {@link PublishedRepositoryWrites}, so a write added by a later Spring Data
 *       version is not silently left out.</li>
 * </ul>
 * Writes outside the repository, such as a plain {@code MongoTemplate} call, are not checked and not published.
 */
@Slf4j
@RequiredArgsConstructor
public class PublishingRepositoryStartupCheck implements SmartInitializingSingleton {

    private static final Set<Class<?>> COUNT_TYPES = Set.of(void.class, Void.class, long.class, Long.class, int.class, Integer.class,
            boolean.class, Boolean.class);
    private static final List<String> WRITE_PREFIXES = List.of("save", "insert", "delete", "remove", "update", "upsert", "replace");

    private final ListableBeanFactory beanFactory;
    private final AggregateSpecRegistry specRegistry;

    @Override
    public void afterSingletonsInstantiated() {
        Map<Class<?>, List<String>> repositoriesByDocument = new HashMap<>();
        // As Spring Data's Repositories does it: the factory beans themselves carry the repository information.
        for (String factoryName : beanFactory.getBeanNamesForType(RepositoryFactoryInformation.class, false, false)) {
            RepositoryFactoryInformation<?, ?> factory = beanFactory.getBean(factoryName, RepositoryFactoryInformation.class);
            RepositoryInformation information = factory.getRepositoryInformation();
            Class<?> documentClass = information.getDomainType();
            if (specRegistry.hasSpecForDocument(documentClass)) {
                Class<?> repositoryInterface = information.getRepositoryInterface();
                repositoriesByDocument.computeIfAbsent(documentClass, document -> new ArrayList<>()).add(repositoryInterface.getName());
                check(factory, information);
            }
        }
        repositoriesByDocument.forEach(PublishingRepositoryStartupCheck::requireOnlyRepository);
        for (AggregateSpec<?, ?> spec : specRegistry.specs()) {
            requireOneRepository(spec, repositoriesByDocument);
        }
    }

    // A subclass document, such as AuthUser of User, may have its own repository, but each document class only one.
    private static void requireOnlyRepository(Class<?> documentClass, List<String> repositories) {
        if (repositories.size() > 1) {
            throw new IllegalStateException(documentClass.getName() + " is published, so it must have exactly one repository, found "
                    + repositories);
        }
    }

    // The interceptor publishes writes through the repository; none means nothing is published, two means two places to watch.
    private static void requireOneRepository(AggregateSpec<?, ?> spec, Map<Class<?>, List<String>> repositoriesByDocument) {
        Class<?> documentClass = PublishedDocuments.classOf(spec);
        List<String> repositories = repositoriesByDocument.getOrDefault(documentClass, List.of());
        if (repositories.size() != 1) {
            throw new IllegalStateException("The spec of " + spec.getType() + " publishes " + documentClass.getName()
                    + ", which must have exactly one repository, found " + repositories);
        }
        log.info("{} publishes {}", repositories.getFirst(), spec.getType());
    }

    private void check(RepositoryFactoryInformation<?, ?> factory, RepositoryInformation information) {
        Class<?> repositoryInterface = information.getRepositoryInterface();
        EntityInformation<?, ?> entity = factory.getEntityInformation();
        requireVersioned(entity, repositoryInterface);
        requireInterceptor(factory, repositoryInterface);
        Class<?> domainType = information.getDomainType();
        for (Method method : information.getQueryMethods()) {
            requirePublishableQueryMethod(method, domainType);
        }
        PublishingRepositoryPointcut pointcut = PublishingRepositoryPointcut.of(information);
        for (Method method : repositoryInterface.getMethods()) {
            requireNoPublishingMarker(method);
            boolean baseWrite = information.isBaseClassMethod(method) && isWriteNamed(method);
            if (baseWrite && !pointcut.matches(method, repositoryInterface)) {
                throw new IllegalStateException(method + " is a Spring Data write that PublishedRepositoryWrites does not list;"
                        + " add it there with @PublishesChange or @PublishesDelete");
            }
        }
        log.debug("Publishing repository {} passed the startup checks", repositoryInterface.getName());
    }

    // The version orders a document's events for consumers.
    private static void requireVersioned(EntityInformation<?, ?> entity, Class<?> repositoryInterface) {
        boolean versioned = entity instanceof MongoEntityInformation<?, ?> mongoEntity && mongoEntity.isVersioned();
        if (!versioned) {
            throw new IllegalStateException(repositoryInterface.getName() + " publishes "
                    + entity.getJavaType().getName() + ", which has no @Version field");
        }
    }

    // A repository created without PublishingRepositoryPostProcessor would publish nothing, silently.
    private static void requireInterceptor(RepositoryFactoryInformation<?, ?> factory, Class<?> repositoryInterface) {
        Object repository = ((RepositoryFactoryBeanSupport<?, ?, ?>) factory).getObject();
        Advisor[] advisors = repository instanceof Advised advised ? advised.getAdvisors() : new Advisor[0];
        boolean intercepted = Arrays.stream(advisors)
                .anyMatch(advisor -> advisor.getAdvice() instanceof PublishingRepositoryInterceptor);
        if (!intercepted) {
            throw new IllegalStateException(repositoryInterface.getName()
                    + " has no PublishingRepositoryInterceptor, so its writes would not be published");
        }
    }

    // @Update and a delete returning a count give the interceptor no documents to publish.
    private static void requirePublishableQueryMethod(Method method, Class<?> domainType) {
        if (AnnotatedElementUtils.hasAnnotation(method, Update.class)) {
            throw new IllegalStateException(method + " is an @Update method, which returns no documents to publish;"
                    + " write it as a custom method with OutboxPublisher.publishChanged");
        }
        Class<?> returnType = method.getReturnType();
        boolean derivedDelete = PublishingRepositoryPointcut.isDerivedDelete(method, domainType);
        if (derivedDelete && COUNT_TYPES.contains(returnType)) {
            throw new IllegalStateException(method + " deletes but returns " + returnType.getSimpleName()
                    + ", so the deleted documents cannot be published; return them, for example as a List");
        }
    }

    // The markers belong to the library's own table; on a repository method they would publish nothing, so they are refused.
    private static void requireNoPublishingMarker(Method method) {
        boolean marked = method.isAnnotationPresent(PublishesChange.class) || method.isAnnotationPresent(PublishesDelete.class);
        if (marked) {
            throw new IllegalStateException(method + " carries a publishing marker, which only the library's own"
                    + " PublishedRepositoryWrites uses; publish a custom write with OutboxPublisher");
        }
    }

    // Only a safety net for a write a later Spring Data version adds to MongoRepository.
    private static boolean isWriteNamed(Method method) {
        String name = method.getName();
        return WRITE_PREFIXES.stream().anyMatch(name::startsWith);
    }
}
