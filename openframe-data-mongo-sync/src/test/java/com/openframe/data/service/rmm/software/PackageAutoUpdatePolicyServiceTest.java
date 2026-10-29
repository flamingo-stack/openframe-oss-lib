package com.openframe.data.service.rmm.software;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdate;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class PackageAutoUpdatePolicyServiceTest {

    private static final PackageUpdateSettings UPDATE_SETTINGS = PackageUpdateSettings.builder()
            .mode(PackageUpdateMode.WAIT).deadlineSeconds(604_800L).countdownSeconds(300).build();

    @Mock private PackageAutoUpdatePolicyRepository repository;

    @InjectMocks private PackageAutoUpdatePolicyService service;

    @Test
    void autoUpdateOn_enablesThePackageOnTheRunsDevices() {
        service.turnOn(rows("m1", "m2"), BrewPackageType.CASK, "title-7",
                SoftwareAutoUpdate.builder().enabled(true).build(), UPDATE_SETTINGS);

        ArgumentCaptor<PackageAutoUpdatePolicy> template = ArgumentCaptor.forClass(PackageAutoUpdatePolicy.class);
        verify(repository).enable(template.capture(), eq(List.of("m1", "m2")));
        PackageAutoUpdatePolicy policy = template.getValue();
        assertThat(policy.getTenantId()).isEqualTo("t1");
        assertThat(policy.getPackageManager()).isEqualTo(PackageManagerType.BREW);
        assertThat(policy.getPackageName()).isEqualTo("slack");
        assertThat(policy.getBrewPackageType()).isEqualTo(BrewPackageType.CASK);
        assertThat(policy.getSoftwareId()).isEqualTo("title-7");
        assertThat(policy.getUpdatedBy()).isEqualTo("admin@x");
        assertThat(policy.getSettings()).isEqualTo(UPDATE_SETTINGS);   // "Same settings for auto-update"
    }

    @Test
    void autoUpdateWithItsOwnSettings_keepsThem() {
        PackageUpdateSettings own = PackageUpdateSettings.builder().mode(PackageUpdateMode.FORCE).countdownSeconds(60).build();

        service.turnOn(rows("m1"), null, null, SoftwareAutoUpdate.builder().enabled(true).settings(own).build(),
                UPDATE_SETTINGS);

        ArgumentCaptor<PackageAutoUpdatePolicy> template = ArgumentCaptor.forClass(PackageAutoUpdatePolicy.class);
        verify(repository).enable(template.capture(), eq(List.of("m1")));
        assertThat(template.getValue().getSettings()).isEqualTo(own);
    }

    @Test
    void autoUpdateOffOrAbsent_leavesPoliciesAlone() {
        service.turnOn(rows("m1"), null, null, SoftwareAutoUpdate.builder().enabled(false).build(), UPDATE_SETTINGS);
        service.turnOn(rows("m1"), null, null, null, UPDATE_SETTINGS);

        verifyNoInteractions(repository);
    }

    private static RunningExecutionRows rows(String... machineIds) {
        return RunningExecutionRows.builder()
                .tenantId("t1")
                .machineIds(List.of(machineIds))
                .packageManager(PackageManagerType.BREW)
                .packageName("slack")
                .initiatedBy("admin@x")
                .build();
    }
}
