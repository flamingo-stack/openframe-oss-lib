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
