package com.openframe.api.service.rmm.fleet;

import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.FleetVulnerability;
import com.openframe.sdk.fleetmdm.model.HostSoftwareInstalledVersion;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static org.springframework.util.StringUtils.hasText;

@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
public class HostInventory {

    private static final HostInventory EMPTY = new HostInventory(List.of(), Map.of());

    @Getter
    private final List<HostSoftwareTitle> titles;
    private final Map<String, FleetVulnerability> detailsBySoftwareCve;

    public static HostInventory empty() {
        return EMPTY;
    }

    public static HostInventory of(List<HostSoftwareTitle> titles, List<FleetSoftware> hostSoftware) {
        Map<String, FleetVulnerability> index = new HashMap<>();
        hostSoftware.forEach(software -> index(software, index));
        return new HostInventory(List.copyOf(titles), index);
    }

    private static void index(FleetSoftware software, Map<String, FleetVulnerability> index) {
        for (FleetVulnerability vulnerability : vulnerabilitiesOf(software)) {
            String key = key(software.getName(), software.getVersion(), vulnerability.getCve());
            index.putIfAbsent(key, vulnerability);
        }
    }

    public Stream<CveHit> hits() {
        return titles.stream().flatMap(HostInventory::hitsOf);
    }

    public static Stream<CveHit> hitsOf(HostSoftwareTitle title) {
        return installedVersionsOf(title).stream().flatMap(installed -> hitsOf(title, installed));
    }

    private static Stream<CveHit> hitsOf(HostSoftwareTitle title, HostSoftwareInstalledVersion installed) {
        return cvesOf(installed).stream()
                .filter(cve -> hasText(cve))
                .map(cve -> new CveHit(title, installed.getVersion(), cve));
    }

    public Optional<FleetVulnerability> detail(CveHit hit) {
        String key = key(hit.getTitle().getName(), hit.getVersion(), hit.getCve());
        return Optional.ofNullable(detailsBySoftwareCve.get(key));
    }

    public static List<HostSoftwareInstalledVersion> installedVersionsOf(HostSoftwareTitle title) {
        return title.getInstalledVersions() == null ? List.of() : title.getInstalledVersions();
    }

    private static List<String> cvesOf(HostSoftwareInstalledVersion installed) {
        return installed.getVulnerabilities() == null ? List.of() : installed.getVulnerabilities();
    }

    private static List<FleetVulnerability> vulnerabilitiesOf(FleetSoftware software) {
        return software.getVulnerabilities() == null ? List.of() : software.getVulnerabilities();
    }

    private static String key(String name, String version, String cve) {
        return name + '|' + version + '|' + cve;
    }

    @Getter
    @AllArgsConstructor
    public static class CveHit {

        private final HostSoftwareTitle title;
        private final String version;
        private final String cve;
    }
}
