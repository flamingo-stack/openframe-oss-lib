package com.openframe.data.nats.packageupdate;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.delivery.PackageUpdateDeliverySeed;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageUpdateDispatchServiceTest {

    @Mock private DeliveryDispatcher deliveryDispatcher;
    @Mock private PackageUpdateRequestRepository requestRepository;
    @Mock private PackageUpdateDeviceStateRepository deviceStateRepository;
    @Mock private ScriptExecutionRepository scriptExecutionRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private PackageUpdateDispatchService service;

    private static RunningExecutionRows rows(String executionId, PackageManagerType manager, String packageName,
                                             String... machineIds) {
        return RunningExecutionRows.builder()
                .executionId(executionId)
                .scriptId("update-script")
                .machineIds(List.of(machineIds))
                .initiatedBy("admin@x")
                .source(ExecutionSource.MANUAL)
                .packageManager(manager)
                .packageName(packageName)
                .softwareAction(SoftwareAction.UPDATE)
                .build();
    }

    @Test
    void adminUpdateNow_winget_persistsRequestDeviceStatesAndOrdersPerMachine() {
        when(tenantIdProvider.getTenantId()).thenReturn("t1");

        service.dispatchAdminUpdateNow(rows("exec-1", PackageManagerType.WINGET, "Google.Chrome", "m1", "m2"), null);

        ArgumentCaptor<PackageUpdateRequest> req = ArgumentCaptor.forClass(PackageUpdateRequest.class);
        verify(requestRepository).save(req.capture());
        PackageUpdateRequest r = req.getValue();
        String requestId = r.getRequestId();
        assertThat(r.getTenantId()).isEqualTo("t1");
        assertThat(requestId).isNotBlank().isNotEqualTo("exec-1");    // own id per dispatch
        assertThat(r.getExecutionId()).isEqualTo("exec-1");
        assertThat(r.getAction()).isEqualTo(SoftwareAction.UPDATE);
        assertThat(r.getSource()).isEqualTo(PackageUpdateSource.ADMIN);
        assertThat(r.getMode()).isEqualTo(PackageUpdateMode.WAIT);          // admin Update now never forces
        assertThat(r.getDeadlineSeconds()).isNull();
        assertThat(r.getForceCountdownSeconds()).isEqualTo(300);
        assertThat(r.getStatus()).isEqualTo(SoftwareActionStatus.SCHEDULED);
        assertThat(r.getTotalMachineCount()).isEqualTo(2);
        assertThat(r.getAttempts()).isEqualTo(1);
        assertThat(r.getInitiatedBy()).isEqualTo("admin@x");

        ArgumentCaptor<List<PackageUpdateDeviceState>> states = ArgumentCaptor.forClass(List.class);
        verify(deviceStateRepository).saveAll(states.capture());
        assertThat(states.getValue()).hasSize(2)
                .allSatisfy(s -> {
                    assertThat(s.getRequestId()).isEqualTo(requestId);
                    assertThat(s.getStatus()).isEqualTo(SoftwareActionStatus.SCHEDULED);
                    assertThat(s.getMode()).isEqualTo(PackageUpdateMode.WAIT);
                });

        ArgumentCaptor<PackageUpdateDeliverySeed> seed = ArgumentCaptor.forClass(PackageUpdateDeliverySeed.class);
        verify(deliveryDispatcher, times(2)).dispatch(seed.capture());
        PackageUpdateDeliverySeed s1 = seed.getAllValues().get(0);
        assertThat(s1.getRequestId()).isEqualTo(requestId);
        assertThat(s1.getMode()).isEqualTo(UpdateMode.WAIT);
        assertThat(s1.getCountdownSeconds()).isNull();                       // WAIT carries no countdown
        assertThat(s1.getSource().getKind()).isEqualTo(UpdateSource.Kind.MANUAL);
        assertThat(s1.getSource().getOrigin()).isEqualTo(UpdateSource.Origin.ADMIN);
        assertThat(s1.getPackageRef().getManager()).isEqualTo(PackageManagerType.WINGET);
        assertThat(s1.getPackageRef().getId()).isEqualTo("Google.Chrome");
        assertThat(s1.getPackageRef().getName()).isNull();
        assertThat(seed.getAllValues()).extracting(PackageUpdateDeliverySeed::getMachineId)
                .containsExactlyInAnyOrder("m1", "m2");
    }

    @Test
    void adminUpdateNow_writesHistoryRowsOwnedByTheRequest_beforeAnyOrder() {
        when(tenantIdProvider.getTenantId()).thenReturn("t1");

        service.dispatchAdminUpdateNow(rows("exec-1", PackageManagerType.WINGET, "Google.Chrome", "m1", "m2"), null);

        InOrder order = inOrder(scriptExecutionRepository, deliveryDispatcher);
        ArgumentCaptor<RunningExecutionRows> leaves = ArgumentCaptor.forClass(RunningExecutionRows.class);
        order.verify(scriptExecutionRepository).saveQueued(leaves.capture());
        order.verify(deliveryDispatcher, times(2)).dispatch(any(PackageUpdateDeliverySeed.class));

        ArgumentCaptor<PackageUpdateRequest> req = ArgumentCaptor.forClass(PackageUpdateRequest.class);
        verify(requestRepository).save(req.capture());
        RunningExecutionRows l = leaves.getValue();
        assertThat(l.getTenantId()).isEqualTo("t1");
        assertThat(l.getExecutionId()).isEqualTo("exec-1");
        assertThat(l.getMachineIds()).containsExactly("m1", "m2");
        assertThat(l.getPackageUpdateRequestId()).isEqualTo(req.getValue().getRequestId());
        assertThat(l.getScriptId()).isEqualTo("update-script");
        assertThat(l.getSoftwareAction()).isEqualTo(SoftwareAction.UPDATE);
    }

    @Test
    void adminUpdateNow_historyRowAlreadyThere_sendsNothing() {
        when(tenantIdProvider.getTenantId()).thenReturn("t1");
        when(scriptExecutionRepository.saveQueued(any())).thenThrow(new DuplicateKeyException("dup"));

        assertThatThrownBy(() -> service.dispatchAdminUpdateNow(
                rows("exec-1", PackageManagerType.WINGET, "Google.Chrome", "m1"), null))
                .isInstanceOf(DuplicateKeyException.class);

        verifyNoInteractions(requestRepository, deviceStateRepository, deliveryDispatcher);
    }

    @Test
    void adminUpdateNow_sameExecutionTwice_getsTwoRequests() {
        // a bundle dispatches per machine and a schedule per fire, both under one execution id
        when(tenantIdProvider.getTenantId()).thenReturn("t1");

        service.dispatchAdminUpdateNow(rows("exec-1", PackageManagerType.WINGET, "Google.Chrome", "m1"), null);
        service.dispatchAdminUpdateNow(rows("exec-1", PackageManagerType.WINGET, "Google.Chrome", "m2"), null);

        ArgumentCaptor<PackageUpdateRequest> req = ArgumentCaptor.forClass(PackageUpdateRequest.class);
        verify(requestRepository, times(2)).save(req.capture());
        assertThat(req.getAllValues()).extracting(PackageUpdateRequest::getExecutionId).containsOnly("exec-1");
        assertThat(req.getAllValues()).extracting(PackageUpdateRequest::getRequestId).doesNotHaveDuplicates();
    }

    @Test
    void adminUpdateNow_repeatedMachine_oneStateAndOneOrder() {
        when(tenantIdProvider.getTenantId()).thenReturn("t1");

        service.dispatchAdminUpdateNow(rows("exec-1", PackageManagerType.WINGET, "Google.Chrome", "m1", "m1", "m2"),
                null);

        ArgumentCaptor<PackageUpdateRequest> req = ArgumentCaptor.forClass(PackageUpdateRequest.class);
        verify(requestRepository).save(req.capture());
        assertThat(req.getValue().getMachineIds()).containsExactly("m1", "m2");
        assertThat(req.getValue().getTotalMachineCount()).isEqualTo(2);

        ArgumentCaptor<List<PackageUpdateDeviceState>> states = ArgumentCaptor.forClass(List.class);
        verify(deviceStateRepository).saveAll(states.capture());
        assertThat(states.getValue()).extracting(PackageUpdateDeviceState::getMachineId).containsExactly("m1", "m2");

        ArgumentCaptor<RunningExecutionRows> leaves = ArgumentCaptor.forClass(RunningExecutionRows.class);
        verify(scriptExecutionRepository).saveQueued(leaves.capture());
        assertThat(leaves.getValue().getMachineIds()).containsExactly("m1", "m2");
        verify(deliveryDispatcher, times(2)).dispatch(any(PackageUpdateDeliverySeed.class));
    }

    @Test
    void dispatch_forceBrew_passesCountdownAndBrewReference() {
        when(tenantIdProvider.getTenantId()).thenReturn("t1");

        service.dispatch(rows("exec-2", PackageManagerType.BREW, "postman", "m1"), BrewPackageType.CASK,
                PackageUpdateSource.AUTO, PackageUpdateMode.FORCE, 120, null);

        ArgumentCaptor<PackageUpdateDeliverySeed> seed = ArgumentCaptor.forClass(PackageUpdateDeliverySeed.class);
        verify(deliveryDispatcher).dispatch(seed.capture());
        PackageUpdateDeliverySeed s = seed.getValue();
        assertThat(s.getMode()).isEqualTo(UpdateMode.FORCE);
        assertThat(s.getCountdownSeconds()).isEqualTo(120);
        assertThat(s.getSource().getKind()).isEqualTo(UpdateSource.Kind.AUTO);
        assertThat(s.getSource().getOrigin()).isNull();                      // AUTO carries no origin
        assertThat(s.getPackageRef().getManager()).isEqualTo(PackageManagerType.BREW);
        assertThat(s.getPackageRef().getKind()).isEqualTo(BrewPackageType.CASK);
        assertThat(s.getPackageRef().getName()).isEqualTo("postman");
        assertThat(s.getPackageRef().getId()).isNull();                      // brew: no winget id
    }
}
