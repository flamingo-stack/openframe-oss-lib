package com.openframe.api.service.rmm.fleet;

import com.openframe.api.dto.rmm.software.SoftwareType;
import lombok.experimental.UtilityClass;

import java.util.Set;

// The kind of a software title, read from the osquery table Fleet names as its source.
@UtilityClass
public class FleetSoftwareType {

    private static final Set<String> APPLICATIONS = Set.of("apps", "programs");
    private static final Set<String> BROWSER_EXTENSIONS = Set.of("chrome_extensions", "firefox_addons",
            "safari_extensions", "ie_extensions");
    private static final Set<String> PACKAGES = Set.of("homebrew_packages", "chocolatey_packages", "deb_packages",
            "rpm_packages", "portage_packages", "pkg_packages", "npm_packages", "python_packages", "atom_packages",
            "go_binaries");

    public static SoftwareType of(String fleetSource) {
        if (fleetSource == null) {
            return null;
        }
        if (APPLICATIONS.contains(fleetSource)) {
            return SoftwareType.APPLICATION;
        }
        if (BROWSER_EXTENSIONS.contains(fleetSource)) {
            return SoftwareType.BROWSER_EXTENSION;
        }
        return PACKAGES.contains(fleetSource) ? SoftwareType.PACKAGE : SoftwareType.OTHER;
    }
}
