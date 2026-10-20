package com.openframe.publishing.repository;

import com.openframe.publishing.api.OutboxPublisher;
import com.openframe.publishing.api.PublishedAggregateSpec;
import com.openframe.publishing.api.PublishingMongoRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.aop.support.DefaultPointcutAdvisor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.data.repository.core.support.RepositoryFactoryBeanSupport;
import org.springframework.data.util.Lazy;

import java.util.function.Supplier;

// Adds PublishingRepositoryInterceptor inside each PublishingMongoRepository's proxy, so aspects on the repository wrap it from outside.
@Slf4j
public class PublishingRepositoryPostProcessor implements BeanPostProcessor {

    // Providers: a BeanPostProcessor is created early, before the beans it needs at the first write.
    private final ObjectProvider<PublishedRepositorySpecs> specs;
    private final ObjectProvider<OutboxPublisher> outboxPublisher;

    public PublishingRepositoryPostProcessor(ObjectProvider<PublishedRepositorySpecs> specs,
                                             ObjectProvider<OutboxPublisher> outboxPublisher) {
        this.specs = specs;
        this.outboxPublisher = outboxPublisher;
    }

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        if (!(bean instanceof RepositoryFactoryBeanSupport<?, ?, ?> factoryBean)) {
            return bean;
        }
        Class<?> repositoryInterface = factoryBean.getObjectType();
        if (repositoryInterface == null || !PublishingMongoRepository.class.isAssignableFrom(repositoryInterface)) {
            return bean;
        }
        Supplier<PublishedAggregateSpec<?, ?>> spec = Lazy.of(() -> specs.getObject().requireSpec(repositoryInterface));
        factoryBean.addRepositoryFactoryCustomizer(factory -> factory.addRepositoryProxyPostProcessor((proxyFactory, information) -> {
            PublishingRepositoryPointcut pointcut = PublishingRepositoryPointcut.of(information);
            PublishingRepositoryInterceptor interceptor = new PublishingRepositoryInterceptor(repositoryInterface, pointcut, spec,
                    outboxPublisher);
            DefaultPointcutAdvisor advisor = new DefaultPointcutAdvisor(pointcut, interceptor);
            proxyFactory.addAdvisor(advisor);
            log.debug("Added the publishing interceptor to {}", repositoryInterface.getName());
        }));
        return bean;
    }
}
