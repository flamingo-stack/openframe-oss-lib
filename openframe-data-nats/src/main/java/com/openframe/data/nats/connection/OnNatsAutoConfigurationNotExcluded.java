package com.openframe.data.nats.connection;

import io.nats.spring.boot.autoconfigure.NatsAutoConfiguration;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.boot.autoconfigure.condition.ConditionEvaluationReport;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;

/**
 * Matches unless {@link NatsAutoConfiguration} is excluded: a context that opts out of its NATS connection must not
 * get the lazy replacement either. Exclusions are recorded when the auto-configurations are selected, before any
 * of them is evaluated.
 */
class OnNatsAutoConfigurationNotExcluded implements Condition {

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        ConfigurableListableBeanFactory beanFactory = context.getBeanFactory();
        if (beanFactory == null) {
            return true;
        }
        return !ConditionEvaluationReport.get(beanFactory).getExclusions().contains(NatsAutoConfiguration.class.getName());
    }
}
