package com.openframe.data.config;

import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "openframe.package-managers")
public class PackageManagerProperties {

    private Set<PackageManagerType> disabled = new HashSet<>();

    public boolean isDisabled(PackageManagerType type) {
        return disabled.contains(type);
    }
}
