package com.openframe.client.listener.packageadopt;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.SoftwareAdoption;
import com.openframe.data.document.rmm.software.SoftwareAdoptionStatus;
import com.openframe.data.nats.packageadopt.PackageAdoptStatusMessage;
import com.openframe.data.nats.packageadopt.PackageAdoptStatusMessage.State;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareAdoptionRepository;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.track.DeliveryTracker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

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
    private static final String EARLIER_REQUEST_ID = "req-0";
    private static final String MACHINE_ID = "m1";
    private static final String DISPATCH_ID = "d-1";
    private static final String ERROR = "brew install --cask postman: exit 1";
    private static final DeliveryRef DELIVERY = new DeliveryRef(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, DISPATCH_ID);

    @Mock private MachineRepository machineRepository;
    @Mock private SoftwareAdoptionRepository softwareAdoptionRepository;
    @Mock private DeliveryTracker deliveryTracker;

    @InjectMocks private PackageAdoptStatusProcessor processor;

    private Machine machine;
    private SoftwareAdoption adoption;
    private MachineDelivery delivery;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        machine.setTenantId(TENANT);
        adoption = SoftwareAdoption.builder()
                .tenantId(TENANT)
                .machineId(MACHINE_ID)
                .softwareId("42")
                .requestId(REQUEST_ID)
                .status(SoftwareAdoptionStatus.ADOPTING)
                .build();
        delivery = new MachineDelivery();
        delivery.setDispatchId(DISPATCH_ID);
    }

    @Test
    void process_done_deliveryClosedDoneThenTheRecordOfThatRequestRemoved() {
        // setup
        PackageAdoptStatusMessage event = status(REQUEST_ID, State.DONE);
        stubAdoptionOfTheRequest();
        InOrder deliveryThenRecord = inOrder(deliveryTracker, softwareAdoptionRepository);

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        deliveryThenRecord.verify(deliveryTracker).done(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID);
        deliveryThenRecord.verify(softwareAdoptionRepository).deleteByTenantIdAndRequestIdAndMachineId(TENANT, REQUEST_ID, MACHINE_ID);
        verify(softwareAdoptionRepository, never()).save(any(SoftwareAdoption.class));
    }

    @Test
    void process_doneAfterTheAdoptionFailed_recordRemovedAndDeliveryClosedDone() {
        // setup
        PackageAdoptStatusMessage event = status(REQUEST_ID, State.DONE);
        adoption.setStatus(SoftwareAdoptionStatus.FAILED);
        adoption.setError("TIMEOUT");
        stubAdoptionOfTheRequest();

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verify(deliveryTracker).done(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID);
        verify(softwareAdoptionRepository).deleteByTenantIdAndRequestIdAndMachineId(TENANT, REQUEST_ID, MACHINE_ID);
    }

    @Test
    void process_failed_recordFailedWithTheAgentsTextThenDeliveryClosedFailedByItsDispatch() {
        // setup
        PackageAdoptStatusMessage event = status(REQUEST_ID, State.FAILED);
        event.setMessage(ERROR);
        stubAdoptionOfTheRequest();
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.of(delivery));
        InOrder recordThenDelivery = inOrder(softwareAdoptionRepository, deliveryTracker);

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        recordThenDelivery.verify(softwareAdoptionRepository).save(adoption);
        recordThenDelivery.verify(deliveryTracker).fail(DELIVERY, MACHINE_ID, ERROR);
        assertThat(adoption)
                .extracting(SoftwareAdoption::getStatus, SoftwareAdoption::getError)
                .containsExactly(SoftwareAdoptionStatus.FAILED, ERROR);
    }

    @Test
    void process_failedWithoutADeliveryRow_recordFailedAndNothingClosed() {
        // setup
        PackageAdoptStatusMessage event = status(REQUEST_ID, State.FAILED);
        event.setMessage(ERROR);
        stubAdoptionOfTheRequest();
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verify(softwareAdoptionRepository).save(adoption);
        verify(deliveryTracker, never()).fail(any(DeliveryRef.class), any(String.class), any(String.class));
        assertThat(adoption.getStatus()).isEqualTo(SoftwareAdoptionStatus.FAILED);
    }

    @Test
    void process_failedWithoutAText_recordFailedWithoutAnError() {
        // setup
        PackageAdoptStatusMessage event = status(REQUEST_ID, State.FAILED);
        stubAdoptionOfTheRequest();
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.of(delivery));

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verify(deliveryTracker).fail(DELIVERY, MACHINE_ID, null);
        assertThat(adoption)
                .extracting(SoftwareAdoption::getStatus, SoftwareAdoption::getError)
                .containsExactly(SoftwareAdoptionStatus.FAILED, null);
    }

    @Test
    void process_lateOrRepeatedStatusOfAFinishedAdoption_ignored() {
        // setup
        PackageAdoptStatusMessage event = status(REQUEST_ID, State.DONE);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(softwareAdoptionRepository.findByTenantIdAndRequestIdAndMachineId(TENANT, REQUEST_ID, MACHINE_ID))
                .thenReturn(Optional.empty());

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verifyNoInteractions(deliveryTracker);
        verify(softwareAdoptionRepository, never()).deleteByTenantIdAndRequestIdAndMachineId(TENANT, REQUEST_ID, MACHINE_ID);
        verify(softwareAdoptionRepository, never()).save(any(SoftwareAdoption.class));
    }

    @Test
    void process_statusOfARequestALaterAdoptionReplaced_theLaterAdoptionIsNotTouched() {
        // setup
        PackageAdoptStatusMessage event = status(EARLIER_REQUEST_ID, State.FAILED);
        event.setMessage(ERROR);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(softwareAdoptionRepository.findByTenantIdAndRequestIdAndMachineId(TENANT, EARLIER_REQUEST_ID, MACHINE_ID))
                .thenReturn(Optional.empty());

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verifyNoInteractions(deliveryTracker);
        verify(softwareAdoptionRepository, never()).save(any(SoftwareAdoption.class));
        assertThat(adoption)
                .extracting(SoftwareAdoption::getRequestId, SoftwareAdoption::getStatus)
                .containsExactly(REQUEST_ID, SoftwareAdoptionStatus.ADOPTING);
    }

    @Test
    void process_unknownMachine_ignored() {
        // setup
        PackageAdoptStatusMessage event = status(REQUEST_ID, State.DONE);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        processor.process(MACHINE_ID, event);

        // verifications
        verifyNoInteractions(softwareAdoptionRepository, deliveryTracker);
    }

    @Test
    void failUndelivered_orderNeverAnswered_recordFailedWithTheReason() {
        // setup
        stubAdoptionOfTheRequest();
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.of(delivery));

        // execution
        processor.failUndelivered(MACHINE_ID, REQUEST_ID, DeliveryFailure.EXHAUSTED);

        // verifications
        verify(softwareAdoptionRepository).save(adoption);
        assertThat(adoption)
                .extracting(SoftwareAdoption::getStatus, SoftwareAdoption::getError)
                .containsExactly(SoftwareAdoptionStatus.FAILED, "EXHAUSTED");
    }

    @Test
    void failUndelivered_agentRefusedTheOrder_recordFailedWithTheReasonAndTheAgentsError() {
        // setup
        delivery.setError("the order could not be stored");
        stubAdoptionOfTheRequest();
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.of(delivery));

        // execution
        processor.failUndelivered(MACHINE_ID, REQUEST_ID, DeliveryFailure.AGENT_ERROR);

        // verifications
        verify(softwareAdoptionRepository).save(adoption);
        assertThat(adoption)
                .extracting(SoftwareAdoption::getStatus, SoftwareAdoption::getError)
                .containsExactly(SoftwareAdoptionStatus.FAILED, "AGENT_ERROR: the order could not be stored");
    }

    @Test
    void failUndelivered_deliveryRowGone_recordFailedWithTheReasonAlone() {
        // setup
        stubAdoptionOfTheRequest();
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        processor.failUndelivered(MACHINE_ID, REQUEST_ID, DeliveryFailure.TIMEOUT);

        // verifications
        verify(softwareAdoptionRepository).save(adoption);
        assertThat(adoption.getError()).isEqualTo("TIMEOUT");
    }

    @Test
    void failUndelivered_adoptionAlreadyFailedByTheDevicesStatus_leftAsIs() {
        // setup
        adoption.setStatus(SoftwareAdoptionStatus.FAILED);
        adoption.setError(ERROR);
        stubAdoptionOfTheRequest();

        // execution
        processor.failUndelivered(MACHINE_ID, REQUEST_ID, DeliveryFailure.AGENT_ERROR);

        // verifications
        verify(softwareAdoptionRepository, never()).save(any(SoftwareAdoption.class));
        verifyNoInteractions(deliveryTracker);
        assertThat(adoption.getError()).isEqualTo(ERROR);
    }

    @Test
    void failUndelivered_recordGoneOrReplaced_nothingSaved() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(softwareAdoptionRepository.findByTenantIdAndRequestIdAndMachineId(TENANT, REQUEST_ID, MACHINE_ID))
                .thenReturn(Optional.empty());

        // execution
        processor.failUndelivered(MACHINE_ID, REQUEST_ID, DeliveryFailure.OFFLINE);

        // verifications
        verify(softwareAdoptionRepository, never()).save(any(SoftwareAdoption.class));
        verifyNoInteractions(deliveryTracker);
    }

    @Test
    void failUndelivered_unknownMachine_ignored() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        processor.failUndelivered(MACHINE_ID, REQUEST_ID, DeliveryFailure.EXHAUSTED);

        // verifications
        verifyNoInteractions(softwareAdoptionRepository, deliveryTracker);
    }

    private void stubAdoptionOfTheRequest() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(softwareAdoptionRepository.findByTenantIdAndRequestIdAndMachineId(TENANT, REQUEST_ID, MACHINE_ID))
                .thenReturn(Optional.of(adoption));
    }

    private static PackageAdoptStatusMessage status(String requestId, State state) {
        PackageAdoptStatusMessage event = new PackageAdoptStatusMessage();
        event.setEventId("e1");
        event.setRequestId(requestId);
        event.setMachineId(MACHINE_ID);
        event.setState(state);
        return event;
    }
}
