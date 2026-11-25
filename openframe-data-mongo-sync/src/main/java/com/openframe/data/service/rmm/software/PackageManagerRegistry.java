package com.openframe.data.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
public class PackageManagerRegistry {

    private final Map<PackageManagerType, PackageManagerHandler> byManager;
    private final PackageManagerProperties packageManagerProperties;

    public PackageManagerRegistry(List<PackageManagerHandler> handlers,
                                  PackageManagerProperties packageManagerProperties) {
        Map<PackageManagerType, PackageManagerHandler> map = new EnumMap<>(PackageManagerType.class);
        for (PackageManagerHandler handler : handlers) {
            PackageManagerHandler previous = map.putIfAbsent(handler.manager(), handler);
            if (previous != null) {
                throw new IllegalStateException("Duplicate PackageManagerHandler for " + handler.manager()
                                + ": " + previous.getClass().getName() + " and " + handler.getClass().getName());
            }
        }
        this.byManager = map;
        this.packageManagerProperties = packageManagerProperties;
    }

    public PackageManagerHandler handlerFor(PackageManagerType manager) {
        if (packageManagerProperties.isDisabled(manager)) {
            throw new BadRequestException("Package manager is disabled: " + manager);
        }
        PackageManagerHandler handler = byManager.get(manager);
        if (handler == null) {
            throw new BadRequestException("Unsupported package manager: " + manager);
        }
        return handler;
    }
}
