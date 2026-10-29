package com.openframe.api.service.rmm.fleet;

import com.openframe.api.service.rmm.fleet.HostInventory.CveHit;
import com.openframe.sdk.fleetmdm.model.FleetVulnerability;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.hostSoftware;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.installedVersion;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.multiVersionTitle;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.title;
import static com.openframe.api.service.rmm.fleet.HostInventoryFixtures.vulnerability;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class HostInventoryTest {

    private static final String CVE_A = "CVE-2024-0001";
    private static final String CVE_B = "CVE-2024-0002";

    @Test
    void detail_hitMatchesHostSoftwareByNameVersionAndCve_returnsVulnerability() {
        // setup
        HostSoftwareTitle chrome = title(10L, "Google Chrome", "apps", "120.0", CVE_A);
        HostInventory inventory = HostInventory.of(List.of(chrome),
                List.of(hostSoftware("Google Chrome", "120.0", vulnerability(CVE_A, 9.8, "121.0"))));
        CveHit hit = HostInventory.hitsOf(chrome).findFirst().orElseThrow();

        // execution
        Optional<FleetVulnerability> detail = inventory.detail(hit);

        // verifications
        assertThat(detail).map(FleetVulnerability::getCvssScore).contains(9.8);
        assertThat(detail).map(FleetVulnerability::getResolvedInVersion).contains("121.0");
    }

    @Test
    void detail_hostSoftwareOnOtherVersion_empty() {
        // setup
        HostSoftwareTitle chrome = title(10L, "Google Chrome", "120.0", "120.0", CVE_A);
        HostInventory inventory = HostInventory.of(List.of(chrome),
                List.of(hostSoftware("Google Chrome", "119.0", vulnerability(CVE_A, 9.8, null))));
        CveHit hit = HostInventory.hitsOf(chrome).findFirst().orElseThrow();

        // execution
        Optional<FleetVulnerability> detail = inventory.detail(hit);

        // verifications
        assertThat(detail).isEmpty();
    }

    @Test
    void hits_titleWithTwoInstalledVersions_oneHitPerVersionAndCve() {
        // setup
        HostSoftwareTitle node = multiVersionTitle(11L, "node", "homebrew_packages",
                installedVersion("18.0", CVE_A, CVE_B), installedVersion("20.1", CVE_A));
        HostInventory inventory = HostInventory.of(List.of(node), List.of());

        // execution
        List<CveHit> hits = inventory.hits().toList();

        // verifications
        assertThat(hits)
                .extracting(CveHit::getVersion, CveHit::getCve)
                .containsExactly(tuple("18.0", CVE_A), tuple("18.0", CVE_B), tuple("20.1", CVE_A));
    }

    @Test
    void empty_noTitlesAndNoHits() {
        // setup
        HostInventory inventory = HostInventory.empty();

        // execution
        List<CveHit> hits = inventory.hits().toList();

        // verifications
        assertThat(inventory.getTitles()).isEmpty();
        assertThat(hits).isEmpty();
    }
}
