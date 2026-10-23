package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DefaultPackageUpdateStatusProcessorTest {

    @Mock private MachineRepository machineRepository;
    @Mock private PackageUpdateDeviceStateRepository deviceStateRepository;
    @Mock private PackageUpdateRequestRepository requestRepository;
    @Mock private PackageUpdateExecutionRecorder executionRecorder;
    @Mock private ObjectProvider<PackageUpdateNotifier> notifierProvider;
    @Mock private PackageUpdateNotifier notifier;

    @InjectMocks private DefaultPackageUpdateStatusProcessor processor;

    private static final Instant T = Instant.parse("2026-10-20T14:00:00Z");

    private void machineResolves() {
        Machine m = new Machine();
        m.setMachineId("m1");
        m.setTenantId("t1");
        when(machineRepository.findByMachineId("m1")).thenReturn(Optional.of(m));
    }

    private PackageUpdateDeviceState state(SoftwareActionStatus status) {
        return PackageUpdateDeviceState.builder()
                .tenantId("t1").requestId("req-1").machineId("m1").status(status).build();
    }

    private PackageUpdateRequest request(PackageUpdateSource source, PackageUpdateMode mode, Long deadlineSeconds) {
        return PackageUpdateRequest.builder()
                .tenantId("t1").requestId("req-1").source(source).mode(mode).deadlineSeconds(deadlineSeconds)
                .status(SoftwareActionStatus.SCHEDULED).build();
    }

    private PackageUpdateStatusMessage waiting(String eventId, Instant at,
                                              PackageUpdateStatusMessage.Waiting.Reason reason,
                                              PackageUpdateStatusMessage.Waiting.Phase phase) {
        PackageUpdateStatusMessage e = base(eventId, at, PackageUpdateStatusMessage.State.WAITING);
        PackageUpdateStatusMessage.Waiting w = new PackageUpdateStatusMessage.Waiting();
        w.setReason(reason);
        w.setPhase(phase);
        PackageUpdateStatusMessage.Holder h = new PackageUpdateStatusMessage.Holder();
        h.setApp("chrome.exe");
        h.setUser("jane");
        w.setHolders(List.of(h));
        e.setWaiting(w);
        return e;
    }

    private PackageUpdateStatusMessage failed(String eventId, PackageUpdateStatusMessage.Failed.Reason reason) {
        PackageUpdateStatusMessage e = base(eventId, T, PackageUpdateStatusMessage.State.FAILED);
        PackageUpdateStatusMessage.Failed f = new PackageUpdateStatusMessage.Failed();
        f.setReason(reason);
        f.setMessage("boom");
        f.setExitCode(1L);
        e.setFailed(f);
        return e;
    }

    private PackageUpdateStatusMessage base(String eventId, Instant at, PackageUpdateStatusMessage.State state) {
        PackageUpdateStatusMessage e = new PackageUpdateStatusMessage();
        e.setEventId(eventId);
        e.setRequestId("req-1");
        e.setMachineId("m1");
        e.setAt(at);
        e.setState(state);
        return e;
    }

    @Test
    void unknownMachine_isIgnored() {
        when(machineRepository.findByMachineId("m1")).thenReturn(Optional.empty());

        processor.process("m1", base("e1", T, PackageUpdateStatusMessage.State.DONE));

        verifyNoInteractions(deviceStateRepository, requestRepository);
    }

    @Test
    void waiting_setsWaitingStatusDetailAndRollsUp() {
        machineResolves();
        PackageUpdateDeviceState st = state(SoftwareActionStatus.SCHEDULED);
        when(deviceStateRepository.findByTenantIdAndRequestIdAndMachineId("t1", "req-1", "m1")).thenReturn(Optional.of(st));
        when(requestRepository.findByTenantIdAndRequestId("t1", "req-1"))
                .thenReturn(Optional.of(request(PackageUpdateSource.ADMIN, PackageUpdateMode.WAIT, null)));
        when(deviceStateRepository.findByTenantIdAndRequestId("t1", "req-1")).thenReturn(List.of(st));

        processor.process("m1", waiting("e1", T,
                PackageUpdateStatusMessage.Waiting.Reason.APP_RUNNING,
                PackageUpdateStatusMessage.Waiting.Phase.PROMPT));

        verify(deviceStateRepository).save(st);
        assertThat(st.getStatus()).isEqualTo(SoftwareActionStatus.WAITING);
        assertThat(st.getWaitingReason()).isEqualTo("APP_RUNNING");
        assertThat(st.getWaitingPhase()).isEqualTo("PROMPT");
        assertThat(st.getHolders()).singleElement().satisfies(h -> {
            assertThat(h.getApp()).isEqualTo("chrome.exe");
            assertThat(h.getUser()).isEqualTo("jane");
        });
        assertThat(st.getLastEventId()).isEqualTo("e1");
        assertThat(st.getLastEventAt()).isEqualTo(T);
        assertThat(st.getDeadlineAt()).isNull();                 // admin Update now: no deadline

        verify(requestRepository).save(any());                   // rolled up to WAITING
        verify(executionRecorder).record(any(), eq("m1"), any()); // mirrored onto the history row
    }

    @Test
    void historyRowWriteFails_stateIsNotSaved_soTheRedeliveryIsNotTakenForADuplicate() {
        machineResolves();
        PackageUpdateDeviceState st = state(SoftwareActionStatus.SCHEDULED);
        when(deviceStateRepository.findByTenantIdAndRequestIdAndMachineId("t1", "req-1", "m1")).thenReturn(Optional.of(st));
        when(requestRepository.findByTenantIdAndRequestId("t1", "req-1"))
                .thenReturn(Optional.of(request(PackageUpdateSource.ADMIN, PackageUpdateMode.WAIT, null)));
        doThrow(new IllegalStateException("mongo down")).when(executionRecorder).record(any(), any(), any());

        assertThatThrownBy(() -> processor.process("m1", base("e1", T, PackageUpdateStatusMessage.State.DONE)))
                .isInstanceOf(IllegalStateException.class);

        verify(deviceStateRepository, never()).save(any());
    }

    @Test
    void duplicateEvent_isSkipped() {
        machineResolves();
        PackageUpdateDeviceState st = state(SoftwareActionStatus.WAITING);
        st.setLastEventId("e1");
        when(deviceStateRepository.findByTenantIdAndRequestIdAndMachineId("t1", "req-1", "m1")).thenReturn(Optional.of(st));

        processor.process("m1", base("e1", T.plusSeconds(10), PackageUpdateStatusMessage.State.DONE));

        verify(deviceStateRepository, never()).save(any());
        verify(requestRepository, never()).save(any());
        verifyNoInteractions(executionRecorder);
    }

    @Test
    void duplicateEvent_afterAFailedRollUp_rollsUpAgain() {
        // the state was saved, the roll-up then failed and the event came back: the request must still roll up
        machineResolves();
        PackageUpdateDeviceState st = state(SoftwareActionStatus.COMPLETED);
        st.setLastEventId("e1");
        PackageUpdateRequest req = request(PackageUpdateSource.ADMIN, PackageUpdateMode.WAIT, null);   // still SCHEDULED
        when(deviceStateRepository.findByTenantIdAndRequestIdAndMachineId("t1", "req-1", "m1")).thenReturn(Optional.of(st));
        when(requestRepository.findByTenantIdAndRequestId("t1", "req-1")).thenReturn(Optional.of(req));
        when(deviceStateRepository.findByTenantIdAndRequestId("t1", "req-1")).thenReturn(List.of(st));

        processor.process("m1", base("e1", T, PackageUpdateStatusMessage.State.DONE));

        verify(requestRepository).save(req);
        assertThat(req.getStatus()).isEqualTo(SoftwareActionStatus.COMPLETED);
        verify(deviceStateRepository, never()).save(any());
        verifyNoInteractions(executionRecorder);
    }

    @Test
    void staleEvent_isSkipped() {
        machineResolves();
        PackageUpdateDeviceState st = state(SoftwareActionStatus.COMPLETED);
        st.setLastEventId("e2");
        st.setLastEventAt(T.plusSeconds(60));
        when(deviceStateRepository.findByTenantIdAndRequestIdAndMachineId("t1", "req-1", "m1")).thenReturn(Optional.of(st));

        processor.process("m1", base("e1", T, PackageUpdateStatusMessage.State.WAITING));  // older than lastEventAt

        verify(deviceStateRepository, never()).save(any());
    }

    @Test
    void done_completesAndClearsWaitingDetail() {
        machineResolves();
        PackageUpdateDeviceState st = state(SoftwareActionStatus.WAITING);
        st.setWaitingReason("APP_RUNNING");
        st.setHolders(List.of(PackageUpdateDeviceState.Holder.builder().app("chrome.exe").user("jane").build()));
        when(deviceStateRepository.findByTenantIdAndRequestIdAndMachineId("t1", "req-1", "m1")).thenReturn(Optional.of(st));
        when(requestRepository.findByTenantIdAndRequestId("t1", "req-1"))
                .thenReturn(Optional.of(request(PackageUpdateSource.ADMIN, PackageUpdateMode.WAIT, null)));
        when(deviceStateRepository.findByTenantIdAndRequestId("t1", "req-1")).thenReturn(List.of(st));

        PackageUpdateStatusMessage e = base("e3", T.plusSeconds(120), PackageUpdateStatusMessage.State.DONE);
        PackageUpdateStatusMessage.Done d = new PackageUpdateStatusMessage.Done();
        d.setResult(PackageUpdateStatusMessage.Done.Result.UPGRADED);
        d.setRebootRequired(true);
        e.setDone(d);

        processor.process("m1", e);

        assertThat(st.getStatus()).isEqualTo(SoftwareActionStatus.COMPLETED);
        assertThat(st.getDoneResult()).isEqualTo("UPGRADED");
        assertThat(st.getRebootRequired()).isTrue();
        assertThat(st.getWaitingReason()).isNull();              // stale waiting detail cleared
        assertThat(st.getHolders()).isNull();
    }

    @Test
    void firstAppRunningWaiting_armsDeadline_whenPolicyHasOne() {
        machineResolves();
        PackageUpdateDeviceState st = state(SoftwareActionStatus.SCHEDULED);
        when(deviceStateRepository.findByTenantIdAndRequestIdAndMachineId("t1", "req-1", "m1")).thenReturn(Optional.of(st));
        when(requestRepository.findByTenantIdAndRequestId("t1", "req-1"))
                .thenReturn(Optional.of(request(PackageUpdateSource.AUTO, PackageUpdateMode.WAIT, 3600L)));
        when(deviceStateRepository.findByTenantIdAndRequestId("t1", "req-1")).thenReturn(List.of(st));

        processor.process("m1", waiting("e1", T,
                PackageUpdateStatusMessage.Waiting.Reason.APP_RUNNING,
                PackageUpdateStatusMessage.Waiting.Phase.PROMPT));

        assertThat(st.getDeadlineAt()).isEqualTo(T.plusSeconds(3600));
    }

    @Test
    void failedAuto_notifiesAdmins_failedManual_notifiesRequester_supersededSilent() {
        machineResolves();
        when(notifierProvider.getIfAvailable()).thenReturn(notifier);

        // AUTO failure -> admins
        PackageUpdateDeviceState a = state(SoftwareActionStatus.WAITING);
        when(deviceStateRepository.findByTenantIdAndRequestIdAndMachineId("t1", "req-1", "m1")).thenReturn(Optional.of(a));
        PackageUpdateRequest auto = request(PackageUpdateSource.AUTO, PackageUpdateMode.WAIT, null);
        when(requestRepository.findByTenantIdAndRequestId("t1", "req-1")).thenReturn(Optional.of(auto));
        when(deviceStateRepository.findByTenantIdAndRequestId("t1", "req-1")).thenReturn(List.of(a));

        processor.process("m1", failed("e1", PackageUpdateStatusMessage.Failed.Reason.MANAGER_ERROR));
        verify(notifier).autoUpdateFailed(auto, a);

        // SUPERSEDED -> no card
        a.setLastEventId("e1");
        processor.process("m1", failed("e2", PackageUpdateStatusMessage.Failed.Reason.SUPERSEDED));
        verify(notifier, never()).updateFailed(any(), any());
    }

    @Test
    void rollUp_mixedDevices() {
        machineResolves();
        PackageUpdateDeviceState m1 = state(SoftwareActionStatus.SCHEDULED);
        PackageUpdateDeviceState m2 = PackageUpdateDeviceState.builder()
                .tenantId("t1").requestId("req-1").machineId("m2").status(SoftwareActionStatus.COMPLETED).build();
        when(deviceStateRepository.findByTenantIdAndRequestIdAndMachineId("t1", "req-1", "m1")).thenReturn(Optional.of(m1));
        PackageUpdateRequest req = request(PackageUpdateSource.ADMIN, PackageUpdateMode.WAIT, null);
        when(requestRepository.findByTenantIdAndRequestId("t1", "req-1")).thenReturn(Optional.of(req));
        when(deviceStateRepository.findByTenantIdAndRequestId("t1", "req-1")).thenReturn(List.of(m1, m2));

        processor.process("m1", failed("e1", PackageUpdateStatusMessage.Failed.Reason.TIMEOUT));  // m1 -> FAILED

        // m1 FAILED + m2 COMPLETED, all terminal, one failed -> request FAILED
        assertThat(req.getStatus()).isEqualTo(SoftwareActionStatus.FAILED);
        verify(requestRepository).save(req);
    }
}
