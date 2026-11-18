package com.openframe.client.listener.packageadopt;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.rmm.software.SoftwareAdoption;
import com.openframe.data.document.rmm.software.SoftwareAdoptionStatus;
import com.openframe.data.repository.rmm.SoftwareAdoptionRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.track.DeliveryDoneEvent;
import com.openframe.delivery.track.DeliveryFailedEvent;
import com.openframe.delivery.track.DeliveryTracker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageAdoptDeliveryListenerTest {

    private static final String TENANT = "t1";
    private static final String REQUEST_ID = "req-1";
    private static final String MACHINE_ID = "m1";

    @Mock private SoftwareAdoptionRepository softwareAdoptionRepository;
    @Mock private DeliveryTracker deliveryTracker;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private PackageAdoptDeliveryListener listener;

    private SoftwareAdoption adoption;
    private MachineDelivery delivery;

    @BeforeEach
    void setUp() {
        adoption = SoftwareAdoption.builder()
                .machineId(MACHINE_ID)
                .requestId(REQUEST_ID)
                .status(SoftwareAdoptionStatus.ADOPTING)
                .build();
        delivery = new MachineDelivery();
    }

    @Test
    void onDeliveryDone_adoptOrderDone_recordOfThatRequestRemoved() {
        // setup
        DeliveryDoneEvent event = new DeliveryDoneEvent(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);

        // execution
        listener.onDeliveryDone(event);

        // verifications
        verify(softwareAdoptionRepository).deleteByTenantIdAndRequestIdAndMachineId(TENANT, REQUEST_ID, MACHINE_ID);
    }

    @Test
    void onDeliveryDone_otherDeliveryType_ignored() {
        // setup
        DeliveryDoneEvent event = new DeliveryDoneEvent(DeliveryType.PACKAGE_UPDATE, REQUEST_ID, MACHINE_ID);

        // execution
        listener.onDeliveryDone(event);

        // verifications
        verifyNoInteractions(softwareAdoptionRepository, tenantIdProvider);
    }

    @Test
    void onDeliveryDone_removalFails_failureStaysHere() {
        // setup
        DeliveryDoneEvent event = new DeliveryDoneEvent(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID);
        IllegalStateException mongoDown = new IllegalStateException("mongo down");
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(softwareAdoptionRepository.deleteByTenantIdAndRequestIdAndMachineId(TENANT, REQUEST_ID, MACHINE_ID))
                .thenThrow(mongoDown);

        // execution and verifications
        assertThatCode(() -> listener.onDeliveryDone(event)).doesNotThrowAnyException();
    }

    @Test
    void onDeliveryFailed_agentReportedAnError_recordFailedWithTheReasonAndTheAgentsError() {
        // setup
        DeliveryFailedEvent event = new DeliveryFailedEvent(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID, DeliveryFailure.AGENT_ERROR);
        delivery.setError("cask postman is not available");
        stubAdoptionOfTheRequest();
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.of(delivery));

        // execution
        listener.onDeliveryFailed(event);

        // verifications
        verify(softwareAdoptionRepository).save(adoption);
        assertThat(adoption)
                .extracting(SoftwareAdoption::getStatus, SoftwareAdoption::getError)
                .containsExactly(SoftwareAdoptionStatus.FAILED, "AGENT_ERROR: cask postman is not available");
    }

    @Test
    void onDeliveryFailed_orderNeverAnswered_recordFailedWithTheReasonAlone() {
        // setup
        DeliveryFailedEvent event = new DeliveryFailedEvent(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID, DeliveryFailure.EXHAUSTED);
        stubAdoptionOfTheRequest();
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.of(delivery));

        // execution
        listener.onDeliveryFailed(event);

        // verifications
        verify(softwareAdoptionRepository).save(adoption);
        assertThat(adoption)
                .extracting(SoftwareAdoption::getStatus, SoftwareAdoption::getError)
                .containsExactly(SoftwareAdoptionStatus.FAILED, "EXHAUSTED");
    }

    @Test
    void onDeliveryFailed_deliveryRowGone_recordFailedWithTheReasonAlone() {
        // setup
        DeliveryFailedEvent event = new DeliveryFailedEvent(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID, DeliveryFailure.TIMEOUT);
        stubAdoptionOfTheRequest();
        when(deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        listener.onDeliveryFailed(event);

        // verifications
        verify(softwareAdoptionRepository).save(adoption);
        assertThat(adoption)
                .extracting(SoftwareAdoption::getStatus, SoftwareAdoption::getError)
                .containsExactly(SoftwareAdoptionStatus.FAILED, "TIMEOUT");
    }

    @Test
    void onDeliveryFailed_recordReplacedByALaterAdoption_nothingSaved() {
        // setup
        DeliveryFailedEvent event = new DeliveryFailedEvent(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID, DeliveryFailure.OFFLINE);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(softwareAdoptionRepository.findByTenantIdAndRequestIdAndMachineId(TENANT, REQUEST_ID, MACHINE_ID))
                .thenReturn(Optional.empty());

        // execution
        listener.onDeliveryFailed(event);

        // verifications
        verify(softwareAdoptionRepository, never()).save(any(SoftwareAdoption.class));
        verifyNoInteractions(deliveryTracker);
    }

    @Test
    void onDeliveryFailed_otherDeliveryType_ignored() {
        // setup
        DeliveryFailedEvent event = new DeliveryFailedEvent(DeliveryType.PACKAGE_UPDATE, REQUEST_ID, MACHINE_ID, DeliveryFailure.EXHAUSTED);

        // execution
        listener.onDeliveryFailed(event);

        // verifications
        verifyNoInteractions(softwareAdoptionRepository, deliveryTracker, tenantIdProvider);
    }

    @Test
    void onDeliveryFailed_recordReadFails_failureStaysHere() {
        // setup
        DeliveryFailedEvent event = new DeliveryFailedEvent(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, MACHINE_ID, DeliveryFailure.TIMEOUT);
        IllegalStateException mongoDown = new IllegalStateException("mongo down");
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(softwareAdoptionRepository.findByTenantIdAndRequestIdAndMachineId(TENANT, REQUEST_ID, MACHINE_ID))
                .thenThrow(mongoDown);

        // execution and verifications
        assertThatCode(() -> listener.onDeliveryFailed(event)).doesNotThrowAnyException();
    }

    private void stubAdoptionOfTheRequest() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(softwareAdoptionRepository.findByTenantIdAndRequestIdAndMachineId(TENANT, REQUEST_ID, MACHINE_ID))
                .thenReturn(Optional.of(adoption));
    }
}
