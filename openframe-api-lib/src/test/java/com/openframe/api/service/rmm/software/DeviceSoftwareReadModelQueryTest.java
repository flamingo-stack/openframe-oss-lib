package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareType;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceSoftwareReadModelQueryTest {

    @Mock private SoftwareRepository softwareRepository;
    @InjectMocks private DeviceSoftwareReadModelQuery query;

    private static Software software(long titleId, String name, String source, Software.Installation... installations) {
        return Software.builder().softwareTitleId(titleId).name(name).source(source).devicesCount(5).cveCount(1)
                .installations(List.of(installations)).build();
    }

    private static Software.Installation on(String machineId, String... versions) {
        return Software.Installation.builder().machineId(machineId).versions(List.of(versions)).build();
    }

    @Test
    void rowsForDevice_theDevicesOwnVersions_typeAndSource() {
        when(softwareRepository.findByTenantIdAndInstallationsMachineId("t1", "m1")).thenReturn(List.of(
                software(1L, "Python", "python_packages", on("m2", "3.13"), on("m1", "3.12", "3.11")),
                software(2L, "Slack", "apps", on("m1", "4.4"))));

        List<SoftwareResponse> rows = query.rowsForDevice("t1", "m1", null);

        SoftwareResponse python = rows.getFirst();
        assertThat(python.getId()).isEqualTo("1");
        assertThat(python.getCurrentVersion()).isEqualTo("3.12");
        assertThat(python.getOlderVersionsCount()).isEqualTo(1);
        assertThat(python.getType()).isEqualTo(SoftwareType.PACKAGE);
        assertThat(python.getSource()).isEqualTo(SoftwareSource.UNMANAGED);
        assertThat(python.getVulnerabilitySummary().getCveCount()).isEqualTo(1);
        assertThat(rows.get(1).getType()).isEqualTo(SoftwareType.APPLICATION);
        assertThat(rows.get(1).getOlderVersionsCount()).isZero();
    }

    @Test
    void rowsForDevice_searchByName_caseInsensitive() {
        when(softwareRepository.findByTenantIdAndInstallationsMachineId("t1", "m1")).thenReturn(List.of(
                software(1L, "Google Chrome", "apps", on("m1", "141")),
                software(2L, "Slack", "apps", on("m1", "4.4")),
                software(3L, null, "apps", on("m1", "1"))));

        assertThat(query.rowsForDevice("t1", "m1", "chrome")).extracting(SoftwareResponse::getName)
                .containsExactly("Google Chrome");
        assertThat(query.rowsForDevice("t1", "m1", " ")).hasSize(3);
    }
}
