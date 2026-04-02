package com.openframe.featureflags;

import com.netflix.graphql.dgs.DgsComponent;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.ComponentScan;

@AutoConfiguration
@ConditionalOnClass(DgsComponent.class)
@EnableConfigurationProperties(FeFeatureFlagProperties.class)
@ComponentScan(basePackageClasses = FeFeatureFlagAutoConfiguration.class)
public class FeFeatureFlagAutoConfiguration {
}
