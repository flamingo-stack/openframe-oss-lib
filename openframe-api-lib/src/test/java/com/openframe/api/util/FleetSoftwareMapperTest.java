package com.openframe.api.util;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.sdk.fleetmdm.model.SoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleVersion;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FleetSoftwareMapperTest {

    @Test
    void toResponse_latestVersionIsTheHighest_inNumericOrder() {
        SoftwareTitle title = new SoftwareTitle();
        title.setVersions(List.of(version("9.0"), version("10.0"), version(null)));

        SoftwareResponse row = FleetSoftwareMapper.toResponse(title);

        assertThat(row.getLatestVersion()).isEqualTo("10.0");
    }

    @Test
    void toResponse_noVersions_noLatest() {
        SoftwareTitle title = new SoftwareTitle();
        title.setName("x");

        assertThat(FleetSoftwareMapper.toResponse(title).getLatestVersion()).isNull();
    }

    private static SoftwareTitleVersion version(String version) {
        SoftwareTitleVersion v = new SoftwareTitleVersion();
        v.setVersion(version);
        return v;
    }

    // a title is one row for every host, so Fleet gives it the vendor and the upgrade code only; the ARP keys are per host
    @Test
    void toResponse_windowsProgram_publisherAndUpgradeCode() {
        SoftwareTitle title = new SoftwareTitle();
        title.setId(7L);
        title.setName("Google Chrome");
        title.setSource("programs");
        title.setUpgradeCode("{UPGRADE}");
        SoftwareTitleVersion newer = new SoftwareTitleVersion();
        newer.setVersion("130.0");
        SoftwareTitleVersion older = new SoftwareTitleVersion();
        older.setVersion("129.0");
        older.setVendor("Google LLC");
        title.setVersions(List.of(newer, older));

        SoftwareResponse row = FleetSoftwareMapper.toResponse(title);

        assertThat(row.getPublisher()).isEqualTo("Google LLC");
        assertThat(row.getUpgradeCode()).isEqualTo("{UPGRADE}");
        assertThat(row.getProductCodes()).isNull();
        assertThat(row.getSystemComponent()).isNull();
    }
}
