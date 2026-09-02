package com.openframe.packagesearch;

import com.netflix.graphql.dgs.DgsComponent;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.ComponentScan;

// activates in the GraphQL api services only — management apps have no DGS on the classpath
@AutoConfiguration
@ConditionalOnClass(DgsComponent.class)
@ComponentScan("com.openframe.packagesearch.api")
public class PackageSearchApiAutoConfiguration {
}
