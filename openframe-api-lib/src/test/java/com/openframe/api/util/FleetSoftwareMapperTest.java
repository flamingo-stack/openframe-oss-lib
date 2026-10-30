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
}
