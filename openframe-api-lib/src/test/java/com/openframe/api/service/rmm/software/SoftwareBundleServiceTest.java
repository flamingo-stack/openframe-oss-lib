package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.CreateSoftwareBundleInput;
import com.openframe.api.dto.rmm.software.SoftwareBundleResponse;
import com.openframe.api.dto.rmm.software.SoftwareDispatchResult;
import com.openframe.api.dto.rmm.software.SoftwareManagementInput;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareBundle;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.document.rmm.software.SoftwareBundleStatus;
import com.openframe.data.repository.rmm.SoftwareBundleRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareBundleServiceTest {

    private static final String TENANT = "t1";
    private static final String USER = "user-1";
    private static final String BUNDLE_ID = "b1";

    @Mock private SoftwareBundleRepository bundleRepository;
    @Mock private SoftwareInstallUpdateManagementService installUpdateService;
    @Mock private TenantIdProvider tenantIdProvider;

    private SoftwareBundleService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareBundleService(bundleRepository, installUpdateService, tenantIdProvider);
        ReflectionTestUtils.setField(service, "pendingTtl", Duration.ofHours(1));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
    }

    @Test
    @DisplayName("create: born PENDING with a TTL anchor, devices and packages persisted")
    void create_bornPending() {
        when(bundleRepository.save(any())).thenAnswer(inv -> withId(inv.getArgument(0)));

        SoftwareBundleResponse res = service.create(createInput(), USER);

        ArgumentCaptor<SoftwareBundle> captor = ArgumentCaptor.forClass(SoftwareBundle.class);
        verify(bundleRepository).save(captor.capture());
        SoftwareBundle saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(SoftwareBundleStatus.PENDING);
        assertThat(saved.getTenantId()).isEqualTo(TENANT);
        assertThat(saved.getMachineIds()).containsExactly("m1");
        assertThat(saved.getPackages()).extracting(SoftwareBundlePackage::getPackageName).containsExactly("slack");
        assertThat(saved.getExpireAt()).isNotNull();
        assertThat(res.getStatus()).isEqualTo(SoftwareBundleStatus.PENDING);
    }

    @Test
    @DisplayName("run: dispatches via the install engine, then flips to COMPLETED and clears the TTL anchor")
    void run_dispatchesAndCompletes() {
        SoftwareBundle pending = pending(SoftwareAction.INSTALL,
                SoftwareBundlePackage.builder().packageManager(PackageManagerType.BREW).packageName("slack").build());
        when(bundleRepository.findByTenantIdAndId(TENANT, BUNDLE_ID)).thenReturn(Optional.of(pending));
        when(installUpdateService.install(any(), eq(USER), eq(ExecutionSource.MANUAL)))
                .thenReturn(List.of(result("exec-1")));

        List<SoftwareDispatchResult> results = service.run(BUNDLE_ID, USER);

        // The engine receives the bundle's devices + packages.
        ArgumentCaptor<SoftwareManagementInput> inputCaptor = ArgumentCaptor.forClass(SoftwareManagementInput.class);
        verify(installUpdateService).install(inputCaptor.capture(), eq(USER), eq(ExecutionSource.MANUAL));
        assertThat(inputCaptor.getValue().getMachineIds()).containsExactly("m1");
        assertThat(inputCaptor.getValue().getPackages()).extracting(SoftwarePackageInput::getPackageName).containsExactly("slack");

        ArgumentCaptor<SoftwareBundle> saveCaptor = ArgumentCaptor.forClass(SoftwareBundle.class);
        verify(bundleRepository).save(saveCaptor.capture());
        SoftwareBundle saved = saveCaptor.getValue();
        assertThat(saved.getStatus()).isEqualTo(SoftwareBundleStatus.COMPLETED);
        assertThat(saved.getCompletedAt()).isNotNull();
        assertThat(saved.getExpireAt()).isNull();
        assertThat(saved.getExecutionIds()).containsExactly("exec-1");
        assertThat(results).extracting(SoftwareDispatchResult::getExecutionId).containsExactly("exec-1");
    }

    @Test
    @DisplayName("run: an already-COMPLETED bundle cannot be re-run (no double dispatch)")
    void run_completed_rejected() {
        SoftwareBundle completed = pending(SoftwareAction.INSTALL,
                SoftwareBundlePackage.builder().packageManager(PackageManagerType.BREW).packageName("slack").build());
        completed.setStatus(SoftwareBundleStatus.COMPLETED);
        when(bundleRepository.findByTenantIdAndId(TENANT, BUNDLE_ID)).thenReturn(Optional.of(completed));

        assertThatThrownBy(() -> service.run(BUNDLE_ID, USER)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(installUpdateService);
        verify(bundleRepository, never()).save(any());
    }

    @Test
    @DisplayName("run: a bundle with no packages is rejected before any dispatch")
    void run_noPackages_rejected() {
        SoftwareBundle empty = pending(SoftwareAction.INSTALL);
        empty.setPackages(List.of());
        when(bundleRepository.findByTenantIdAndId(TENANT, BUNDLE_ID)).thenReturn(Optional.of(empty));

        assertThatThrownBy(() -> service.run(BUNDLE_ID, USER)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(installUpdateService);
        verify(bundleRepository, never()).save(any());
    }

    @Test
    @DisplayName("delete: a COMPLETED bundle is protected (history is immutable)")
    void delete_completed_rejected() {
        SoftwareBundle completed = pending(SoftwareAction.INSTALL);
        completed.setStatus(SoftwareBundleStatus.COMPLETED);
        when(bundleRepository.findByTenantIdAndId(TENANT, BUNDLE_ID)).thenReturn(Optional.of(completed));

        assertThatThrownBy(() -> service.delete(BUNDLE_ID, USER)).isInstanceOf(BadRequestException.class);
        verify(bundleRepository, never()).delete(any());
    }

    private static CreateSoftwareBundleInput createInput() {
        CreateSoftwareBundleInput input = new CreateSoftwareBundleInput();
        input.setAction(SoftwareAction.INSTALL);
        input.setMachineIds(List.of("m1"));
        SoftwarePackageInput pkg = new SoftwarePackageInput();
        pkg.setPackageManager(PackageManagerType.BREW);
        pkg.setPackageName("slack");
        input.setPackages(List.of(pkg));
        return input;
    }

    private static SoftwareBundle pending(SoftwareAction action, SoftwareBundlePackage... packages) {
        return SoftwareBundle.builder()
                .id(BUNDLE_ID)
                .tenantId(TENANT)
                .action(action)
                .status(SoftwareBundleStatus.PENDING)
                .machineIds(List.of("m1"))
                .packages(List.of(packages))
                .build();
    }

    private static SoftwareBundle withId(SoftwareBundle b) {
        if (b.getId() == null) {
            b.setId(BUNDLE_ID);
        }
        return b;
    }

    private static SoftwareDispatchResult result(String executionId) {
        return SoftwareDispatchResult.builder()
                .packageManager(PackageManagerType.BREW)
                .packageName("slack")
                .executionId(executionId)
                .build();
    }
}
