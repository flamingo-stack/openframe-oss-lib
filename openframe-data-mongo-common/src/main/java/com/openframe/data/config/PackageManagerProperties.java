package com.openframe.data.config;

import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "openframe.package-managers")
public class PackageManagerProperties {

    private boolean chocoEnabled = false;

    public boolean isDisabled(PackageManagerType type) {
        return type == PackageManagerType.CHOCO && !chocoEnabled;
    }
}
