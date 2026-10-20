package com.openframe.publishing.repository;

import com.openframe.publishing.api.PublishedAggregateSpec;
import com.openframe.publishing.api.PublishingMongoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ListableBeanFactory;
import org.springframework.core.ResolvableType;
import org.springframework.stereotype.Component;

// The spec a PublishingMongoRepository names in its third type argument, as the single bean of that class.
@Component
@RequiredArgsConstructor
public class PublishedRepositorySpecs {

    private static final int SPEC_TYPE_ARGUMENT = 2;

    private final ListableBeanFactory beanFactory;

    public PublishedAggregateSpec<?, ?> requireSpec(Class<?> repositoryInterface) {
        ResolvableType publishingType = ResolvableType.forClass(repositoryInterface).as(PublishingMongoRepository.class);
        Class<?> specClass = publishingType.getGeneric(SPEC_TYPE_ARGUMENT).resolve();
        if (specClass == null) {
            throw new IllegalStateException(repositoryInterface.getName() + " must name its spec class in PublishingMongoRepository");
        }
        String[] specBeans = beanFactory.getBeanNamesForType(specClass);
        if (specBeans.length != 1) {
            throw new IllegalStateException(repositoryInterface.getName() + " names " + specClass.getName()
                    + ", which must be exactly one bean, found " + specBeans.length);
        }
        return (PublishedAggregateSpec<?, ?>) beanFactory.getBean(specBeans[0]);
    }
}
