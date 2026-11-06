package com.openframe.data.document.rmm.software;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;

import static java.util.stream.Collectors.toMap;

// the osquery table Fleet took a software row from, as Fleet names it in `source`; OTHER for a table we do not know
@Getter
@RequiredArgsConstructor
public enum FleetSource {
    APPS("apps"),
    PROGRAMS("programs"),
    HOMEBREW_PACKAGES("homebrew_packages"),
    CHOCOLATEY_PACKAGES("chocolatey_packages"),
    DEB_PACKAGES("deb_packages"),
    RPM_PACKAGES("rpm_packages"),
    PORTAGE_PACKAGES("portage_packages"),
    PKG_PACKAGES("pkg_packages"),
    NPM_PACKAGES("npm_packages"),
    PYTHON_PACKAGES("python_packages"),
    ATOM_PACKAGES("atom_packages"),
    GO_BINARIES("go_binaries"),
    CHROME_EXTENSIONS("chrome_extensions"),
    FIREFOX_ADDONS("firefox_addons"),
    SAFARI_EXTENSIONS("safari_extensions"),
    IE_EXTENSIONS("ie_extensions"),
    VSCODE_EXTENSIONS("vscode_extensions"),
    JETBRAINS_PLUGINS("jetbrains_plugins"),
    OTHER("");

    private static final Map<String, FleetSource> BY_FLEET_NAME = Arrays.stream(values())
            .filter(source -> source != OTHER)
            .collect(toMap(FleetSource::getFleetName, Function.identity()));

    private final String fleetName;

    public static FleetSource of(String fleetName) {
        return fleetName == null ? OTHER : BY_FLEET_NAME.getOrDefault(fleetName, OTHER);
    }
}
