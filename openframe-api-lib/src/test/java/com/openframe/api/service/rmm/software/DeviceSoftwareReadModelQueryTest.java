package com.openframe.api.service.rmm.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareSource;
import com.openframe.api.dto.rmm.software.SoftwareType;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import com.openframe.data.document.rmm.software.PackageMatchState;
import com.openframe.data.document.rmm.software.SoftwarePackageMatch;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceSoftwareReadModelQueryTest {

    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private SoftwareRepository softwareRepository;
    @InjectMocks private DeviceSoftwareReadModelQuery query;

    private static Software software(long titleId, String name, String source) {
        return Software.builder().softwareTitleId(titleId).name(name).source(source).devicesCount(5).cveCount(1).build();
    }

    private static DeviceSoftware.DeviceSoftwareBuilder onM1(long titleId, String... versions) {
        return DeviceSoftware.builder().machineId("m1").softwareTitleId(titleId).machineConnected(true)
                .versions(Arrays.asList(versions));
    }

    @Test
    void rowsForDevice_theDevicesOwnVersions_typeAndSource() {
        DeviceSoftware python = onM1(1L, "3.12", "3.11", "3.12", null).build();
        DeviceSoftware slack = onM1(2L, "4.4").build();
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(python, slack));
        when(softwareRepository.findByTenantIdAndSoftwareTitleIdIn("t1", List.of(1L, 2L))).thenReturn(List.of(
                software(1L, "Python", "python_packages"), software(2L, "Slack", "apps")));

        List<SoftwareResponse> rows = query.rowsForDevice("t1", "m1", null);

        SoftwareResponse pythonRow = rows.getFirst();
        assertThat(pythonRow.getId()).isEqualTo("1");
        assertThat(pythonRow.getCurrentVersion()).isEqualTo("3.12");
        assertThat(pythonRow.getOlderVersionsCount()).isEqualTo(1);
        assertThat(pythonRow.getType()).isEqualTo(SoftwareType.PACKAGE);
        assertThat(pythonRow.getSource()).isEqualTo(SoftwareSource.UNMANAGED);
        assertThat(pythonRow.getVulnerabilitySummary().getCveCount()).isEqualTo(1);
        assertThat(rows.get(1).getType()).isEqualTo(SoftwareType.APPLICATION);
        assertThat(rows.get(1).getCurrentVersion()).isEqualTo("4.4");
        assertThat(rows.get(1).getOlderVersionsCount()).isZero();
    }

    @Test
    void rowsForDevice_skipsDisconnectedRowsAndTitlesWithoutSoftware() {
        DeviceSoftware disconnected = onM1(1L, "1.0").machineConnected(false).build();
        DeviceSoftware noTitle = DeviceSoftware.builder().machineId("m1").machineConnected(true).build();
        DeviceSoftware notProjectedYet = onM1(3L, "2.0").build();
        DeviceSoftware slack = onM1(2L, "4.4").versions(null).build();
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1"))
                .thenReturn(List.of(disconnected, noTitle, notProjectedYet, slack));
        when(softwareRepository.findByTenantIdAndSoftwareTitleIdIn("t1", List.of(3L, 2L)))
                .thenReturn(List.of(software(2L, "Slack", "apps")));

        List<SoftwareResponse> rows = query.rowsForDevice("t1", "m1", null);

        assertThat(rows).extracting(SoftwareResponse::getId).containsExactly("2");
        assertThat(rows.getFirst().getCurrentVersion()).isNull();
        assertThat(rows.getFirst().getOlderVersionsCount()).isZero();
    }

    @Test
    void rowsForDevice_noConnectedRows_noSoftwareLookup() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of());

        assertThat(query.rowsForDevice("t1", "m1", null)).isEmpty();
        verifyNoInteractions(softwareRepository);
    }

    @Test
    void rowsForDevice_searchByName_caseInsensitive() {
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(
                onM1(1L, "141").build(), onM1(2L, "4.4").build(), onM1(3L, "1").build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleIdIn("t1", List.of(1L, 2L, 3L))).thenReturn(List.of(
                software(1L, "Google Chrome", "apps"), software(2L, "Slack", "apps"), software(3L, null, "apps")));

        assertThat(query.rowsForDevice("t1", "m1", "chrome")).extracting(SoftwareResponse::getName)
                .containsExactly("Google Chrome");
        assertThat(query.rowsForDevice("t1", "m1", " ")).hasSize(3);
        verify(softwareRepository, org.mockito.Mockito.times(2)).findByTenantIdAndSoftwareTitleIdIn("t1", List.of(1L, 2L, 3L));
    }

    @Test
    void rowsForDevice_carriesTheProgramKeysAndTheStoredMatch() {
        Software chrome = software(3L, "Google Chrome", "programs");
        chrome.setVendor("Google LLC");
        chrome.setUpgradeCode("{UPGRADE}");
        chrome.setArpKeys(List.of("Google Chrome"));
        chrome.setPackageFamilyNames(List.of("google.chrome_x"));
        chrome.setSystemComponent(false);
        chrome.setPackageMatch(new SoftwarePackageMatch(PackageMatchState.NO_PACKAGE, null, null, null));
        when(deviceSoftwareRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(List.of(onM1(3L, "130.0").build()));
        when(softwareRepository.findByTenantIdAndSoftwareTitleIdIn("t1", List.of(3L))).thenReturn(List.of(chrome));

        SoftwareResponse row = query.rowsForDevice("t1", "m1", null).getFirst();

        assertThat(row.getFleetSource()).isEqualTo(FleetSource.PROGRAMS);
        assertThat(row.getPublisher()).isEqualTo("Google LLC");
        assertThat(row.getUpgradeCode()).isEqualTo("{UPGRADE}");
        assertThat(row.getProductCodes()).containsExactly("Google Chrome");
        assertThat(row.getPackageFamilyNames()).containsExactly("google.chrome_x");
        assertThat(row.getSystemComponent()).isFalse();
        assertThat(row.getPackageMatch().getState()).isEqualTo(PackageMatchState.NO_PACKAGE);
    }
}
