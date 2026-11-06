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

    @Test
    void toResponse_windowsProgram_keysFromItsVersions() {
        SoftwareTitle title = new SoftwareTitle();
        title.setId(7L);
        title.setName("Google Chrome");
        title.setSource("programs");
        title.setUpgradeCode("{UPGRADE}");
        SoftwareTitleVersion exe = new SoftwareTitleVersion();
        exe.setVersion("130.0");
        exe.setVendor("Google LLC");
        exe.setArpKey("Google Chrome");
        exe.setSystemComponent(false);
        SoftwareTitleVersion msi = new SoftwareTitleVersion();
        msi.setVersion("129.0");
        msi.setArpKey("{8A69D345-D564-463C-AFF1-A69D9E530F96}");
        msi.setPackageFamilyName("");
        title.setVersions(List.of(exe, msi));

        SoftwareResponse row = FleetSoftwareMapper.toResponse(title);

        assertThat(row.getPublisher()).isEqualTo("Google LLC");
        assertThat(row.getUpgradeCode()).isEqualTo("{UPGRADE}");
        assertThat(row.getProductCodes()).containsExactly("Google Chrome", "{8A69D345-D564-463C-AFF1-A69D9E530F96}");
        assertThat(row.getPackageFamilyNames()).isEmpty();
        assertThat(row.getSystemComponent()).isFalse();
    }

    @Test
    void toResponse_noVersionReportsTheFlag_systemComponentUnknown() {
        SoftwareTitle title = new SoftwareTitle();
        title.setName("Slack");
        title.setSource("apps");
        SoftwareTitleVersion version = new SoftwareTitleVersion();
        version.setVersion("4.0");
        title.setVersions(List.of(version));

        SoftwareResponse row = FleetSoftwareMapper.toResponse(title);

        assertThat(row.getSystemComponent()).isNull();
        assertThat(row.getPublisher()).isNull();
        assertThat(row.getProductCodes()).isEmpty();
    }
}
