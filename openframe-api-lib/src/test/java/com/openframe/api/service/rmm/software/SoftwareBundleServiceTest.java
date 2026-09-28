package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareBundleResponse;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.api.dto.rmm.software.SubmitSoftwareBundleInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionResult;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareBundle;
import com.openframe.data.document.rmm.software.SoftwareBundleMode;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.document.rmm.software.SoftwareBundleStatus;
import com.openframe.data.repository.rmm.SoftwareActionResultRepository;
import com.openframe.data.repository.rmm.SoftwareBundleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareBundleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.MachinePlatformResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareBundleServiceTest {

    private static final String TENANT = "t1";
    private static final String USER = "user-1";
    private static final String BUNDLE_ID = "b1";
    private static final long RECONNECT_WINDOW = 604800L;

    @Mock private SoftwareBundleRepository bundleRepository;
    @Mock private SoftwareBundleOnlineDispatchRepository onlineDispatchRepository;
    @Mock private SoftwareScheduleService softwareScheduleService;
    @Mock private SoftwareActionResultRepository softwareActionResultRepository;
    @Mock private MachinePlatformResolver machinePlatformResolver;
    @Mock private TenantIdProvider tenantIdProvider;

    private SoftwareBundleService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareBundleService(bundleRepository, onlineDispatchRepository, softwareScheduleService,
                softwareActionResultRepository, machinePlatformResolver, tenantIdProvider);
        ReflectionTestUtils.setField(service, "pendingTtl", Duration.ofHours(1));
        ReflectionTestUtils.setField(service, "scheduleReconnectWindowSeconds", RECONNECT_WINDOW);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
    }

    @Test
    @DisplayName("delete: a PENDING bundle is removed")
    void delete_pending_ok() {
        SoftwareBundle pending = pending(SoftwareBundleMode.NOW, null, List.of("m1"));
        when(bundleRepository.findByTenantIdAndId(TENANT, BUNDLE_ID)).thenReturn(Optional.of(pending));

        assertThat(service.delete(BUNDLE_ID, USER)).isTrue();
        verify(bundleRepository).delete(pending);
    }

    @Test
    @DisplayName("delete: a COMPLETED bundle returns false and is left untouched (history is immutable)")
    void delete_completed_returnsFalseUntouched() {
        SoftwareBundle completed = pending(SoftwareBundleMode.NOW, null, List.of("m1"));
        completed.setStatus(SoftwareBundleStatus.COMPLETED);
        when(bundleRepository.findByTenantIdAndId(TENANT, BUNDLE_ID)).thenReturn(Optional.of(completed));

        assertThat(service.delete(BUNDLE_ID, USER)).isFalse();
        verify(bundleRepository, never()).delete(any());
    }

    @Test
    @DisplayName("delete: an unknown/already-reaped id returns true (idempotent, never throws)")
    void delete_unknown_returnsTrue() {
        when(bundleRepository.findByTenantIdAndId(TENANT, "gone")).thenReturn(Optional.empty());

        assertThat(service.delete("gone", USER)).isTrue();
        verify(bundleRepository, never()).delete(any());
    }

    @Test
    @DisplayName("submit NOW: validates, arms sentinels, fills one executionId per package, marks COMPLETED")
    void submit_now_ok() {
        SoftwareBundle draft = pending(SoftwareBundleMode.NOW, null, List.of("m1", "m2"),
                SoftwareBundlePackage.builder().packageManager(PackageManagerType.BREW).packageName("x").build());
        when(bundleRepository.findByTenantIdAndId(TENANT, BUNDLE_ID)).thenReturn(Optional.of(draft));
        when(machinePlatformResolver.osTypesByMachineId(any()))
                .thenReturn(java.util.Map.of("m1", OsType.MAC_OS, "m2", OsType.MAC_OS));
        when(onlineDispatchRepository.findByTenantIdAndMachineIdAndBundleId(eq(TENANT), anyString(), eq(BUNDLE_ID)))
                .thenReturn(Optional.empty());

        SoftwareBundleResponse res = service.submit(submitInput(brewPkg("slack"), brewPkg("chrome")), USER);

        verify(onlineDispatchRepository, times(2)).save(any());
        ArgumentCaptor<SoftwareBundle> saved = ArgumentCaptor.forClass(SoftwareBundle.class);
        verify(bundleRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(SoftwareBundleStatus.COMPLETED);
        assertThat(saved.getValue().getExecutionIds()).hasSize(2);
        assertThat(saved.getValue().getExpireAt()).isNull();
        assertThat(res.getStatus()).isEqualTo(SoftwareBundleStatus.COMPLETED);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<SoftwareActionResult>> results = ArgumentCaptor.forClass(List.class);
        verify(softwareActionResultRepository).saveAll(results.capture());
        assertThat(results.getValue()).hasSize(2).allSatisfy(r -> {
            assertThat(r.getBundleId()).isEqualTo(BUNDLE_ID);
            assertThat(r.getScheduleId()).isNull();
            assertThat(r.getStatus()).isEqualTo(SoftwareActionStatus.IN_PROGRESS);
            assertThat(r.getMode()).isEqualTo(SoftwareBundleMode.NOW);
            assertThat(r.getMachineIds()).containsExactlyInAnyOrder("m1", "m2"); // both macOS -> both compatible with brew
            assertThat(r.getId()).isEqualTo(r.getExecutionId());
            assertThat(r.getVersion()).isEqualTo("1.2.3"); // catalog version recorded on the action
        });
    }

    @Test
    @DisplayName("submit: re-submitting a COMPLETED bundle returns it unchanged, no second dispatch")
    void submit_completed_idempotent() {
        SoftwareBundle completed = pending(SoftwareBundleMode.NOW, null, List.of("m1"),
                SoftwareBundlePackage.builder().packageManager(PackageManagerType.BREW).packageName("x").build());
        completed.setStatus(SoftwareBundleStatus.COMPLETED);
        when(bundleRepository.findByTenantIdAndId(TENANT, BUNDLE_ID)).thenReturn(Optional.of(completed));

        SoftwareBundleResponse res = service.submit(submitInput(brewPkg("slack")), USER);

        assertThat(res.getStatus()).isEqualTo(SoftwareBundleStatus.COMPLETED);
        verify(bundleRepository, never()).save(any());
        verifyNoInteractions(onlineDispatchRepository, softwareScheduleService);
    }

    @Test
    @DisplayName("submit: a device whose OS no package can run fails, naming that device")
    void submit_incompatibleDevice_rejected() {
        SoftwareBundle draft = pending(SoftwareBundleMode.NOW, null, List.of("m-win"),
                SoftwareBundlePackage.builder().packageManager(PackageManagerType.BREW).packageName("x").build());
        when(bundleRepository.findByTenantIdAndId(TENANT, BUNDLE_ID)).thenReturn(Optional.of(draft));
        when(machinePlatformResolver.osTypesByMachineId(any())).thenReturn(java.util.Map.of("m-win", OsType.WINDOWS));

        assertThatThrownBy(() -> service.submit(submitInput(brewPkg("slack")), USER))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("m-win");
        verify(bundleRepository, never()).save(any());
        verifyNoInteractions(onlineDispatchRepository);
    }

    @Test
    @DisplayName("submit: a brew package without brewPackageType is rejected")
    void submit_brewNoType_rejected() {
        SoftwareBundle draft = pending(SoftwareBundleMode.NOW, null, List.of("m1"),
                SoftwareBundlePackage.builder().packageManager(PackageManagerType.BREW).packageName("x").build());
        when(bundleRepository.findByTenantIdAndId(TENANT, BUNDLE_ID)).thenReturn(Optional.of(draft));

        SoftwarePackageInput noType = new SoftwarePackageInput();
        noType.setPackageManager(PackageManagerType.BREW);
        noType.setPackageName("slack"); // brewPackageType missing

        assertThatThrownBy(() -> service.submit(submitInput(noType), USER))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("brewPackageType");
        verify(bundleRepository, never()).save(any());
    }

    private static SubmitSoftwareBundleInput submitInput(SoftwarePackageInput... packages) {
        SubmitSoftwareBundleInput input = new SubmitSoftwareBundleInput();
        input.setId(BUNDLE_ID);
        input.setAction(SoftwareAction.INSTALL);
        input.setPackages(List.of(packages));
        return input;
    }

    private static SoftwarePackageInput brewPkg(String name) {
        SoftwarePackageInput p = new SoftwarePackageInput();
        p.setPackageManager(PackageManagerType.BREW);
        p.setPackageName(name);
        p.setBrewPackageType(BrewPackageType.CASK);
        p.setVersion("1.2.3");
        return p;
    }

    private static SoftwareBundle pending(SoftwareBundleMode mode, Instant startAt, List<String> machineIds,
                                          SoftwareBundlePackage... packages) {
        return SoftwareBundle.builder()
                .id(BUNDLE_ID)
                .tenantId(TENANT)
                .action(SoftwareAction.INSTALL)
                .mode(mode)
                .status(SoftwareBundleStatus.PENDING)
                .machineIds(machineIds)
                .packages(List.of(packages))
                .startAt(startAt)
                .build();
    }
}
