package com.openframe.client.listener.packageadopt;

import com.openframe.client.listener.packageupdate.PackageUpdateExecutionRecorder;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.packageadopt.PackageAdoptStatusMessage;
import com.openframe.data.nats.packageadopt.PackageAdoptStatusMessage.Outcome;
import com.openframe.data.nats.packageadopt.PackageAdoptStatusMessage.State;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.track.DeliveryTracker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageAdoptStatusProcessorTest {

    private static final String TENANT = "t1";
    private static final String REQUEST_ID = "req-1";
    private static final String MACHINE_ID = "m1";
    private static final String OTHER_MACHINE_ID = "m2";
    private static final String DISPATCH_ID = "d-1";
    private static final String ERROR = "brew install --cask postman: exit 1";
    private static final String ENGINE_ERROR = "EXHAUSTED";
    private static final DeliveryRef DELIVERY = new DeliveryRef(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, DISPATCH_ID);

    @Mock private MachineRepository machineRepository;
    @Mock private PackageUpdateRequestRepository packageUpdateRequestRepository;
    @Mock private PackageUpdateDeviceStateRepository packageUpdateDeviceStateRepository;
    @Mock private PackageUpdateExecutionRecorder packageUpdateExecutionRecorder;
    @Mock private DeliveryTracker deliveryTracker;

    @Captor private ArgumentCaptor<PackageUpdateRequest> requestCaptor;

    @InjectMocks private PackageAdoptStatusProcessor processor;

    private Machine machine;
    private PackageUpdateRequest request;
    private MachineDelivery delivery;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setTenantId(TENANT);
        request = PackageUpdateRequest.builder()
                .tenantId(TENANT)
                .requestId(REQUEST_ID)
                .executionId("exec-1")
                .action(SoftwareAction.ADOPT)
                .softwareId("42")
                .status(SoftwareActionStatus.IN_PROGRESS)
                .machineIds(List.of(MACHINE_ID))
                .build();
        delivery = new MachineDelivery();
        delivery.setDispatchId(DISPATCH_ID);
    }

    @Test
    void process_done_stateCompletedThenHistoryThenDeliveryClosedDone() {
        // setup
        PackageAdoptStatusMessage event = status(State.DONE, null);
        stubAdoptRequest();
        stubTransition(SoftwareActionStatus.COMPLETED, null, true);
        stubDeviceStates(state(MACHINE_ID, SoftwareActionStatus.COMPLETED));
        InOrder stateThenHistoryThenDelivery = inOrder(packageUpdateDeviceStateRepository,
                packageUpdateExecutionRecorder, deliveryTracker);

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        stateThenHistoryThenDelivery.verify(packageUpdateDeviceStateRepository)
                .finishInProgress(TENANT, REQUEST_ID, MACHINE_ID, SoftwareActionStatus.COMPLETED, null);
        stateThenHistoryThenDelivery.verify(packageUpdateExecutionRecorder)
                .recordDone(request, MACHINE_ID, PackageAdoptStatusProcessor.ADOPTED_SUMMARY);
        stateThenHistoryThenDelivery.verify(deliveryTracker).done(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID);
    }

    @ParameterizedTest
    @MethodSource("doneReports")
    void process_doneWithOutcomeAndRestart_historySaysWhatHappened(Outcome outcome, Boolean restartRequired,
                                                                   String summary) {
        // setup
        PackageAdoptStatusMessage event = status(State.DONE, null);
        event.setOutcome(outcome);
        event.setRestartRequired(restartRequired);
        stubAdoptRequest();
        stubTransition(SoftwareActionStatus.COMPLETED, null, true);
        stubDeviceStates(state(MACHINE_ID, SoftwareActionStatus.COMPLETED));

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verify(packageUpdateExecutionRecorder).recordDone(request, MACHINE_ID, summary);
    }

    @ParameterizedTest
    @MethodSource("failedReports")
    void process_failedWithOrWithoutAReason_errorShapedAsAnEngineError(String reason, String message, String error) {
        // setup
        PackageAdoptStatusMessage event = status(State.FAILED, message);
        event.setReason(reason);
        stubAdoptRequest();
        stubTransition(SoftwareActionStatus.FAILED, error, true);
        stubDeviceStates(state(MACHINE_ID, SoftwareActionStatus.FAILED));
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verify(packageUpdateExecutionRecorder).recordFailed(request, MACHINE_ID, error);
    }

    @Test
    void process_doneOfTheLastDevice_requestCompleted() {
        // setup
        PackageAdoptStatusMessage event = status(State.DONE, null);
        stubAdoptRequest();
        stubTransition(SoftwareActionStatus.COMPLETED, null, true);
        stubDeviceStates(state(MACHINE_ID, SoftwareActionStatus.COMPLETED));

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verify(packageUpdateRequestRepository).save(requestCaptor.capture());
        assertThat(requestCaptor.getValue())
                .extracting(PackageUpdateRequest::getStatus)
                .isEqualTo(SoftwareActionStatus.COMPLETED);
        assertThat(requestCaptor.getValue().getUpdatedAt()).isNotNull();
    }

    @Test
    void process_doneWhileAnotherDeviceStillAdopts_requestStaysInProgress() {
        // setup
        PackageAdoptStatusMessage event = status(State.DONE, null);
        stubAdoptRequest();
        stubTransition(SoftwareActionStatus.COMPLETED, null, true);
        stubDeviceStates(state(MACHINE_ID, SoftwareActionStatus.COMPLETED),
                state(OTHER_MACHINE_ID, SoftwareActionStatus.IN_PROGRESS));

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verify(packageUpdateRequestRepository, never()).save(any(PackageUpdateRequest.class));
    }

    @Test
    void process_failed_stateFailedWithTheAgentsTextThenHistoryThenDeliveryClosedFailedByItsDispatch() {
        // setup
        PackageAdoptStatusMessage event = status(State.FAILED, ERROR);
        stubAdoptRequest();
        stubTransition(SoftwareActionStatus.FAILED, ERROR, true);
        stubDeviceStates(state(MACHINE_ID, SoftwareActionStatus.FAILED));
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.of(delivery));
        InOrder stateThenHistoryThenDelivery = inOrder(packageUpdateDeviceStateRepository,
                packageUpdateExecutionRecorder, deliveryTracker);

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        stateThenHistoryThenDelivery.verify(packageUpdateDeviceStateRepository)
                .finishInProgress(TENANT, REQUEST_ID, MACHINE_ID, SoftwareActionStatus.FAILED, ERROR);
        stateThenHistoryThenDelivery.verify(packageUpdateExecutionRecorder).recordFailed(request, MACHINE_ID, ERROR);
        stateThenHistoryThenDelivery.verify(deliveryTracker).fail(DELIVERY, MACHINE_ID, ERROR);
    }

    @Test
    void process_failedOfTheLastDevice_requestFailed() {
        // setup
        PackageAdoptStatusMessage event = status(State.FAILED, ERROR);
        stubAdoptRequest();
        stubTransition(SoftwareActionStatus.FAILED, ERROR, true);
        stubDeviceStates(state(MACHINE_ID, SoftwareActionStatus.FAILED),
                state(OTHER_MACHINE_ID, SoftwareActionStatus.COMPLETED));
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verify(packageUpdateRequestRepository).save(requestCaptor.capture());
        assertThat(requestCaptor.getValue().getStatus()).isEqualTo(SoftwareActionStatus.FAILED);
    }

    @Test
    void process_failedWithoutADeliveryRow_stateFailedAndNothingClosed() {
        // setup
        PackageAdoptStatusMessage event = status(State.FAILED, ERROR);
        stubAdoptRequest();
        stubTransition(SoftwareActionStatus.FAILED, ERROR, true);
        stubDeviceStates(state(MACHINE_ID, SoftwareActionStatus.FAILED));
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verify(packageUpdateExecutionRecorder).recordFailed(request, MACHINE_ID, ERROR);
        verify(deliveryTracker, never()).fail(any(DeliveryRef.class), any(String.class), any(String.class));
    }

    @Test
    void process_failedWithoutAText_stateAndDeliveryFailedWithTheDefaultError() {
        // setup
        PackageAdoptStatusMessage event = status(State.FAILED, " ");
        String error = PackageAdoptStatusProcessor.FAILED_ERROR;
        stubAdoptRequest();
        stubTransition(SoftwareActionStatus.FAILED, error, true);
        stubDeviceStates(state(MACHINE_ID, SoftwareActionStatus.FAILED));
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.of(delivery));

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verify(packageUpdateExecutionRecorder).recordFailed(request, MACHINE_ID, error);
        verify(deliveryTracker).fail(DELIVERY, MACHINE_ID, error);
    }

    @Test
    void process_doneOfAStateNoLongerInProgress_noOp() {
        // setup
        PackageAdoptStatusMessage event = status(State.DONE, null);
        stubAdoptRequest();
        stubTransition(SoftwareActionStatus.COMPLETED, null, false);

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verifyNoInteractions(packageUpdateExecutionRecorder, deliveryTracker);
        verify(packageUpdateDeviceStateRepository, never()).findByTenantIdAndRequestId(TENANT, REQUEST_ID);
        verify(packageUpdateRequestRepository, never()).save(any(PackageUpdateRequest.class));
    }

    @Test
    void process_failedOfAStateNoLongerInProgress_noOp() {
        // setup
        PackageAdoptStatusMessage event = status(State.FAILED, ERROR);
        stubAdoptRequest();
        stubTransition(SoftwareActionStatus.FAILED, ERROR, false);

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verifyNoInteractions(packageUpdateExecutionRecorder, deliveryTracker);
        verify(packageUpdateRequestRepository, never()).save(any(PackageUpdateRequest.class));
    }

    @Test
    void failByEngine_inProgress_stateFailedWithTheEnginesReasonThenHistoryAndNoDeliveryCall() {
        // setup
        stubTransition(SoftwareActionStatus.FAILED, ENGINE_ERROR, true);
        stubDeviceStates(state(MACHINE_ID, SoftwareActionStatus.FAILED));
        InOrder stateThenHistory = inOrder(packageUpdateDeviceStateRepository, packageUpdateExecutionRecorder);

        // execution
        processor.failByEngine(request, MACHINE_ID, ENGINE_ERROR);

        // verifications
        stateThenHistory.verify(packageUpdateDeviceStateRepository)
                .finishInProgress(TENANT, REQUEST_ID, MACHINE_ID, SoftwareActionStatus.FAILED, ENGINE_ERROR);
        stateThenHistory.verify(packageUpdateExecutionRecorder).recordFailed(request, MACHINE_ID, ENGINE_ERROR);
        verifyNoInteractions(deliveryTracker);
    }

    @Test
    void failByEngine_lastDevice_requestFailed() {
        // setup
        stubTransition(SoftwareActionStatus.FAILED, ENGINE_ERROR, true);
        stubDeviceStates(state(MACHINE_ID, SoftwareActionStatus.FAILED));

        // execution
        processor.failByEngine(request, MACHINE_ID, ENGINE_ERROR);

        // verifications
        verify(packageUpdateRequestRepository).save(requestCaptor.capture());
        assertThat(requestCaptor.getValue().getStatus()).isEqualTo(SoftwareActionStatus.FAILED);
    }

    @Test
    void failByEngine_stateNoLongerInProgress_noOp() {
        // setup
        stubTransition(SoftwareActionStatus.FAILED, ENGINE_ERROR, false);

        // execution
        processor.failByEngine(request, MACHINE_ID, ENGINE_ERROR);

        // verifications
        verifyNoInteractions(packageUpdateExecutionRecorder, deliveryTracker);
        verify(packageUpdateRequestRepository, never()).save(any(PackageUpdateRequest.class));
    }

    @Test
    void process_doneAfterTheEngineFailureWasClosed_noOp() {
        // setup
        PackageAdoptStatusMessage event = status(State.DONE, null);
        stubTransition(SoftwareActionStatus.FAILED, ENGINE_ERROR, true);
        stubDeviceStates(state(MACHINE_ID, SoftwareActionStatus.FAILED));
        stubAdoptRequest();
        stubTransition(SoftwareActionStatus.COMPLETED, null, false);
        processor.failByEngine(request, MACHINE_ID, ENGINE_ERROR);

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verify(packageUpdateExecutionRecorder, never()).recordDone(request, MACHINE_ID,
                PackageAdoptStatusProcessor.ADOPTED_SUMMARY);
        verify(packageUpdateRequestRepository).save(request);
        verifyNoInteractions(deliveryTracker);
    }

    @Test
    void process_requestOfAnUpdate_ignored() {
        // setup
        PackageAdoptStatusMessage event = status(State.DONE, null);
        request.setAction(SoftwareAction.UPDATE);
        stubAdoptRequest();

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verifyNoInteractions(packageUpdateDeviceStateRepository, packageUpdateExecutionRecorder, deliveryTracker);
    }

    @Test
    void process_unknownRequest_ignored() {
        // setup
        PackageAdoptStatusMessage event = status(State.DONE, null);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(packageUpdateRequestRepository.findByTenantIdAndRequestId(TENANT, REQUEST_ID)).thenReturn(Optional.empty());

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verifyNoInteractions(packageUpdateDeviceStateRepository, packageUpdateExecutionRecorder, deliveryTracker);
    }

    @Test
    void process_unknownMachine_ignored() {
        // setup
        PackageAdoptStatusMessage event = status(State.DONE, null);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verifyNoInteractions(packageUpdateRequestRepository, packageUpdateDeviceStateRepository,
                packageUpdateExecutionRecorder, deliveryTracker);
    }

    private static Stream<Arguments> doneReports() {
        return Stream.of(
                Arguments.of(null, null, "Adopted."),
                Arguments.of(Outcome.ADOPTED_IN_PLACE, false, "Adopted in place."),
                Arguments.of(Outcome.REINSTALLED, null, "Reinstalled."),
                Arguments.of(Outcome.REINSTALLED, true, "Reinstalled. Restart the app."),
                Arguments.of(Outcome.ALREADY_MANAGED, null, "Already managed by Homebrew."),
                Arguments.of(Outcome.ALREADY_MANAGED, true, "Already managed by Homebrew. Restart the app."),
                Arguments.of(null, true, "Adopted. Restart the app."));
    }

    private static Stream<Arguments> failedReports() {
        return Stream.of(
                Arguments.of("INSTALL_FAILED", ERROR, "INSTALL_FAILED: " + ERROR),
                Arguments.of("MANAGER_MISSING", null, "MANAGER_MISSING"),
                Arguments.of(null, ERROR, ERROR),
                Arguments.of(" ", ERROR, ERROR),
                Arguments.of(null, null, PackageAdoptStatusProcessor.FAILED_ERROR));
    }

    private void stubAdoptRequest() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(packageUpdateRequestRepository.findByTenantIdAndRequestId(TENANT, REQUEST_ID)).thenReturn(Optional.of(request));
    }

    private void stubTransition(SoftwareActionStatus status, String failedMessage, boolean moved) {
        when(packageUpdateDeviceStateRepository.finishInProgress(TENANT, REQUEST_ID, MACHINE_ID, status, failedMessage))
                .thenReturn(moved);
    }

    private void stubDeviceStates(PackageUpdateDeviceState... states) {
        when(packageUpdateDeviceStateRepository.findByTenantIdAndRequestId(TENANT, REQUEST_ID)).thenReturn(List.of(states));
    }

    private static PackageUpdateDeviceState state(String machineId, SoftwareActionStatus status) {
        return PackageUpdateDeviceState.builder()
                .tenantId(TENANT)
                .requestId(REQUEST_ID)
                .machineId(machineId)
                .status(status)
                .build();
    }

    private static PackageAdoptStatusMessage status(State state, String message) {
        PackageAdoptStatusMessage event = new PackageAdoptStatusMessage();
        event.setEventId("e1");
        event.setRequestId(REQUEST_ID);
        event.setMachineId(MACHINE_ID);
        event.setState(state);
        event.setMessage(message);
        return event;
    }
}
