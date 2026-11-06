package com.openframe.api.service.rmm.fleet;

import com.openframe.api.dto.rmm.software.SoftwareSource;

import java.util.Arrays;
import java.util.Set;

import static java.util.stream.Collectors.toUnmodifiableSet;

public enum FleetSoftwareCategory {

    CHOCOLATEY(SoftwareSource.CHOCOLATEY, "chocolatey_packages"),
    HOMEBREW(SoftwareSource.BREW, "homebrew_packages"),
    OTHER(SoftwareSource.UNMANAGED);

    private final SoftwareSource source;
    private final Set<String> fleetSources;

    FleetSoftwareCategory(SoftwareSource source, String... fleetSources) {
        this.source = source;
        this.fleetSources = Set.of(fleetSources);
    }

    public SoftwareSource source() {
        return source;
    }

    // the Fleet sources that name the manager that installed the title
    public static Set<String> managerSources() {
        return Arrays.stream(values())
                .filter(category -> category.source != SoftwareSource.UNMANAGED)
                .flatMap(category -> category.fleetSources.stream())
                .collect(toUnmodifiableSet());
    }

    public static FleetSoftwareCategory of(String fleetSource) {
        if (fleetSource != null) {
            for (FleetSoftwareCategory c : values()) {
                if (c.fleetSources.contains(fleetSource)) {
                    return c;
                }
            }
        }
        return OTHER;
    }
}
