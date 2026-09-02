package com.openframe.packagesearch;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.ComponentScan;

// enabled in the management services' config only; the host app must have scheduling enabled
@AutoConfiguration
@ConditionalOnProperty(name = "openframe.package-search.sync.enabled", havingValue = "true")
@ComponentScan("com.openframe.packagesearch.sync")
public class PackageSearchSyncAutoConfiguration {
}
