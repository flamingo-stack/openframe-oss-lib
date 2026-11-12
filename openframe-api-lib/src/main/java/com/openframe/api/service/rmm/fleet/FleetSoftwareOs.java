package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.software.FleetSource;
import lombok.experimental.UtilityClass;

import java.util.Collection;
import java.util.Map;
import java.util.Set;

import static java.util.stream.Collectors.toUnmodifiableSet;

// The system a software title belongs to, read from the osquery table Fleet names as its source. Null for a table
// several systems have (browser extensions, npm, python, …) and for a Linux one: OsType has no Linux.
@UtilityClass
public class FleetSoftwareOs {

    private static final Map<FleetSource, OsType> OS_BY_SOURCE = Map.of(
            FleetSource.PROGRAMS, OsType.WINDOWS,
            FleetSource.CHOCOLATEY_PACKAGES, OsType.WINDOWS,
            FleetSource.WINGET_PACKAGES, OsType.WINDOWS,
            FleetSource.IE_EXTENSIONS, OsType.WINDOWS,
            FleetSource.APPS, OsType.MAC_OS,
            FleetSource.HOMEBREW_PACKAGES, OsType.MAC_OS,
            FleetSource.SAFARI_EXTENSIONS, OsType.MAC_OS,
            FleetSource.PKG_PACKAGES, OsType.MAC_OS);

    public static OsType of(FleetSource fleetSource) {
        return fleetSource == null ? null : OS_BY_SOURCE.get(fleetSource);
    }

    public static Set<String> fleetSources(Collection<OsType> osTypes) {
        return OS_BY_SOURCE.entrySet().stream()
                .filter(entry -> osTypes.contains(entry.getValue()))
                .map(entry -> entry.getKey().getFleetName())
                .collect(toUnmodifiableSet());
    }
}
