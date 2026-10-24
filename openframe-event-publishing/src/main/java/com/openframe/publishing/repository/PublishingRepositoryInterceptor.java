package com.openframe.publishing.repository;

import com.openframe.publishing.api.OutboxPublisher;
import com.openframe.publishing.api.spec.AggregateSpec;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.aopalliance.intercept.MethodInterceptor;
import org.aopalliance.intercept.MethodInvocation;
import org.springframework.beans.factory.ObjectProvider;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

// Inside the repository proxy, so aspects on the repository run outside the outbox transaction, never in it.
@Slf4j
class PublishingRepositoryInterceptor implements MethodInterceptor {

    private final Class<?> repositoryInterface;
    private final PublishingRepositoryPointcut pointcut;
    private final Supplier<AggregateSpec<?, ?>> spec;
    private final ObjectProvider<OutboxPublisher> outboxPublisher;

    PublishingRepositoryInterceptor(Class<?> repositoryInterface,
                                    PublishingRepositoryPointcut pointcut,
                                    Supplier<AggregateSpec<?, ?>> spec,
                                    ObjectProvider<OutboxPublisher> outboxPublisher) {
        this.repositoryInterface = repositoryInterface;
        this.pointcut = pointcut;
        this.spec = spec;
        this.outboxPublisher = outboxPublisher;
    }

    // Reached only for the pointcut's methods: a @PublishesChange or @PublishesDelete one, or a derived delete.
    @Override
    public Object invoke(MethodInvocation invocation) {
        Method method = invocation.getMethod();
        PublishedWrite write = pointcut.writeOf(method);
        AggregateSpec<?, ?> publishedSpec = spec.get();
        OutboxPublisher publisher = outboxPublisher.getObject();
        Supplier<Object> proceed = () -> proceed(invocation);
        log.debug("{}.{} is a {} write of {}", repositoryInterface.getSimpleName(), method.getName(), write,
                publishedSpec.getType());
        return switch (write) {
            case CHANGE -> publisher.publishChanged(publishedSpec, proceed);
            case DERIVED_DELETE -> publisher.publishDeleted(publishedSpec, proceed);
            case DELETE_ALL -> {
                publisher.publishDeletedAll(publishedSpec);
                yield null;
            }
            case DELETE_BY_ID, DELETE_ALL_BY_ID, DELETE_DOCUMENT, DELETE_DOCUMENTS -> {
                Object argument = invocation.getArguments()[0];
                yield deleteBy(write, argument, publishedSpec, publisher, proceed);
            }
            case NONE -> throw new IllegalStateException(method + " is not a published method");
        };
    }

    // A null argument goes to Spring Data unchanged, which refuses it as it does without publishing.
    private static Object deleteBy(PublishedWrite write,
                                   Object argument,
                                   AggregateSpec<?, ?> spec,
                                   OutboxPublisher publisher,
                                   Supplier<Object> proceed) {
        if (argument == null) {
            log.debug("{} with a null argument goes to Spring Data unpublished", write);
            return proceed.get();
        }
        return switch (write) {
            case DELETE_BY_ID -> {
                List<Object> ids = List.of(argument);
                yield publisher.publishDeletedByIds(spec, ids, proceed);
            }
            case DELETE_ALL_BY_ID -> {
                List<Object> ids = listOf((Iterable<?>) argument);
                yield publisher.publishDeletedByIds(spec, ids, proceed);
            }
            case DELETE_DOCUMENT -> {
                List<Object> stored = List.of(argument);
                yield publisher.publishDeleted(spec, () -> stored, proceed);
            }
            case DELETE_DOCUMENTS -> {
                List<Object> stored = listOf((Iterable<?>) argument);
                yield publisher.publishDeleted(spec, () -> stored, proceed);
            }
            default -> throw new IllegalStateException(write + " is not a delete by argument");
        };
    }

    private static List<Object> listOf(Iterable<?> items) {
        List<Object> list = new ArrayList<>();
        items.forEach(list::add);
        return list;
    }

    @SneakyThrows
    private static Object proceed(MethodInvocation invocation) {
        return invocation.proceed();
    }
}
