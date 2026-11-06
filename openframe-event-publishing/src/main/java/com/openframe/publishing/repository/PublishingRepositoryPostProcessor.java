package com.openframe.publishing.repository;

import com.openframe.publishing.api.OutboxPublisher;
import com.openframe.publishing.api.PublishedDocuments;
import com.openframe.publishing.api.spec.AggregateSpec;
import com.openframe.publishing.registry.AggregateSpecRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.aop.support.DefaultPointcutAdvisor;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.beans.factory.BeanFactoryAware;
import org.springframework.beans.factory.ListableBeanFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.core.ResolvableType;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.core.support.RepositoryFactoryBeanSupport;
import org.springframework.data.util.Lazy;

import java.util.function.Supplier;

// Adds PublishingRepositoryInterceptor inside the proxy of each repository whose document has a spec, so aspects wrap it from outside.
@Slf4j
public class PublishingRepositoryPostProcessor implements BeanPostProcessor, BeanFactoryAware {

    private static final int DOCUMENT_TYPE_ARGUMENT = 0;

    // Providers: a BeanPostProcessor is created early, before the beans it needs at the first write.
    private final ObjectProvider<AggregateSpecRegistry> specRegistry;
    private final ObjectProvider<OutboxPublisher> outboxPublisher;
    private ListableBeanFactory beanFactory;

    public PublishingRepositoryPostProcessor(ObjectProvider<AggregateSpecRegistry> specRegistry,
                                             ObjectProvider<OutboxPublisher> outboxPublisher) {
        this.specRegistry = specRegistry;
        this.outboxPublisher = outboxPublisher;
    }

    @Override
    public void setBeanFactory(BeanFactory beanFactory) {
        this.beanFactory = (ListableBeanFactory) beanFactory;
    }

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        if (!(bean instanceof RepositoryFactoryBeanSupport<?, ?, ?> factoryBean)) {
            return bean;
        }
        Class<?> repositoryInterface = factoryBean.getObjectType();
        Class<?> documentClass = repositoryInterface == null ? null : documentClassOf(repositoryInterface);
        if (documentClass == null || !hasSpecFor(documentClass)) {
            return bean;
        }
        Supplier<AggregateSpec<?, ?>> spec = Lazy.of(() -> specRegistry.getObject().specOfDocument(documentClass));
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

    // From the bean definitions' types, never the spec beans: a spec needs its projection, which may need this very repository.
    private boolean hasSpecFor(Class<?> documentClass) {
        String[] specNames = beanFactory.getBeanNamesForType(AggregateSpec.class, true, false);
        for (String specName : specNames) {
            Class<?> specClass = beanFactory.getType(specName, false);
            Class<?> specDocument = specClass == null ? null : PublishedDocuments.classOfSpecClass(specClass);
            if (documentClass.equals(specDocument)) {
                return true;
            }
        }
        return false;
    }

    private static Class<?> documentClassOf(Class<?> repositoryInterface) {
        ResolvableType repositoryType = ResolvableType.forClass(repositoryInterface).as(Repository.class);
        return repositoryType.getGeneric(DOCUMENT_TYPE_ARGUMENT).resolve();
    }
}
