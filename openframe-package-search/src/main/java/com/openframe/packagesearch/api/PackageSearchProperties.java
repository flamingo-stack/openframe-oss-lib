package com.openframe.packagesearch.api;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "openframe.package-search")
public class PackageSearchProperties {

    private Choco choco = new Choco();
    private Winget winget = new Winget();

    @Getter
    @Setter
    public static class Choco {
        private String baseUrl = "https://community.chocolatey.org/api/v2";
        private Duration timeout = Duration.ofSeconds(15);
        private Duration cacheTtl = Duration.ofMinutes(30);
    }

    @Getter
    @Setter
    public static class Winget {
        private String baseUrl = "https://cdn.winget.microsoft.com";
        private Duration timeout = Duration.ofSeconds(30);
        private Duration detailCacheTtl = Duration.ofMinutes(30);
    }
}
