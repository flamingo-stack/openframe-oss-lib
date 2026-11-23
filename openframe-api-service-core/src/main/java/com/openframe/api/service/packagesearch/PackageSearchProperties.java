package com.openframe.api.service.packagesearch;

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

    private Winget winget = new Winget();

    @Getter
    @Setter
    public static class Winget {
        private String baseUrl = "https://cdn.winget.microsoft.com";
        private Duration timeout = Duration.ofSeconds(30);
        private Duration detailCacheTtl = Duration.ofMinutes(30);
    }
}
