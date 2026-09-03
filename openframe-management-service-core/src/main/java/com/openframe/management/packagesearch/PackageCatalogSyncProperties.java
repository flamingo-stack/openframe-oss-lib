package com.openframe.management.packagesearch;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "openframe.package-search.sync")
public class PackageCatalogSyncProperties {

    // must stay in step with the @Scheduled placeholders in PackageCatalogSyncScheduler —
    // the same values also size the cross-tenant sync lock
    private Duration brewInterval = Duration.ofMillis(900000);
    private Duration wingetInterval = Duration.ofMillis(1800000);

    private Brew brew = new Brew();
    private Winget winget = new Winget();

    @Getter
    @Setter
    public static class Brew {
        private String baseUrl = "https://formulae.brew.sh";
        private Duration timeout = Duration.ofSeconds(30);
    }

    @Getter
    @Setter
    public static class Winget {
        private String baseUrl = "https://cdn.winget.microsoft.com";
        private Duration timeout = Duration.ofSeconds(30);
    }
}
