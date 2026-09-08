package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareSource;

import java.util.Set;

enum FleetSoftwareCategory {

    CHOCOLATEY(SoftwareSource.CHOCOLATEY, "chocolatey_packages"),
    HOMEBREW(SoftwareSource.BREW, "homebrew_packages"),
    OTHER(SoftwareSource.UNMANAGED);

    private final SoftwareSource source;
    private final Set<String> fleetSources;

    FleetSoftwareCategory(SoftwareSource source, String... fleetSources) {
        this.source = source;
        this.fleetSources = Set.of(fleetSources);
    }

    SoftwareSource source() {
        return source;
    }

    /** Never returns null — unknown / missing input falls back to {@link #OTHER}. */
    static FleetSoftwareCategory of(String fleetSource) {
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
