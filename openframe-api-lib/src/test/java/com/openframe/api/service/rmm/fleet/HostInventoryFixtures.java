package com.openframe.api.service.rmm.fleet;

import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.FleetVulnerability;
import com.openframe.sdk.fleetmdm.model.HostSoftwareInstalledVersion;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;

import java.util.List;

public final class HostInventoryFixtures {

    private HostInventoryFixtures() {
    }

    public static HostSoftwareTitle title(Long id, String name, String source, String version, String... cves) {
        return multiVersionTitle(id, name, source, installedVersion(version, cves));
    }

    public static HostSoftwareTitle multiVersionTitle(Long id, String name, String source,
                                                      HostSoftwareInstalledVersion... versions) {
        HostSoftwareTitle title = new HostSoftwareTitle();
        title.setId(id);
        title.setName(name);
        title.setSource(source);
        title.setInstalledVersions(List.of(versions));
        return title;
    }

    public static HostSoftwareInstalledVersion installedVersion(String version, String... cves) {
        HostSoftwareInstalledVersion installed = new HostSoftwareInstalledVersion();
        installed.setVersion(version);
        installed.setVulnerabilities(List.of(cves));
        return installed;
    }

    public static FleetSoftware hostSoftware(String name, String version, FleetVulnerability... vulnerabilities) {
        FleetSoftware software = new FleetSoftware();
        software.setName(name);
        software.setVersion(version);
        software.setVulnerabilities(List.of(vulnerabilities));
        return software;
    }

    public static FleetVulnerability vulnerability(String cve, Double cvssScore, String resolvedInVersion) {
        FleetVulnerability vulnerability = new FleetVulnerability();
        vulnerability.setCve(cve);
        vulnerability.setCvssScore(cvssScore);
        vulnerability.setResolvedInVersion(resolvedInVersion);
        return vulnerability;
    }

    public static FleetVulnerability exploitedVulnerability(String cve, Double cvssScore) {
        FleetVulnerability vulnerability = vulnerability(cve, cvssScore, null);
        vulnerability.setCisaKnownExploit(true);
        return vulnerability;
    }
}
