package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.track.DeliveryId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageAdoptDeliveryFailureReaderTest {

    private static final String REQUEST_ID = "req-1";
    private static final String MAC = "mac-1";
    private static final String OTHER_MAC = "mac-2";
    private static final String STATE_ID = "state-1";
    private static final String OTHER_STATE_ID = "state-2";

    @Mock private MachineDeliveryRepository machineDeliveryRepository;

    @InjectMocks private PackageAdoptDeliveryFailureReader reader;

    private Instant now;
    private Instant longAgo;

    @BeforeEach
    void setUp() {
        now = Instant.now();
        longAgo = now.minus(Duration.ofHours(1));
    }

    @Test
    void getFailedMessagesByStateId_openDelivery_none() {
        // setup
        PackageUpdateDeviceState state = state(STATE_ID, MAC, SoftwareActionStatus.IN_PROGRESS, longAgo);
        stubDeliveries(Set.of(deliveryId(MAC)), delivery(MAC, DeliveryStatus.ACKED, null, null));

        // execution
        Map<String, String> failures = reader.getFailedMessagesByStateId(List.of(state));

        // verifications
        assertThat(failures).isEmpty();
    }

    @Test
    void getFailedMessagesByStateId_deliveryFailedByTheEngine_theEnginesReason() {
        // setup
        PackageUpdateDeviceState state = state(STATE_ID, MAC, SoftwareActionStatus.IN_PROGRESS, longAgo);
        stubDeliveries(Set.of(deliveryId(MAC)), delivery(MAC, DeliveryStatus.FAILED, DeliveryFailure.EXHAUSTED, null));

        // execution
        Map<String, String> failures = reader.getFailedMessagesByStateId(List.of(state));

        // verifications
        assertThat(failures).containsOnly(Map.entry(STATE_ID, "EXHAUSTED"));
    }

    @Test
    void getFailedMessagesByStateId_deliveryFailedWithTheAgentsError_reasonAndError() {
        // setup
        PackageUpdateDeviceState state = state(STATE_ID, MAC, SoftwareActionStatus.IN_PROGRESS, longAgo);
        stubDeliveries(Set.of(deliveryId(MAC)),
                delivery(MAC, DeliveryStatus.FAILED, DeliveryFailure.AGENT_ERROR, "unknown type"));

        // execution
        Map<String, String> failures = reader.getFailedMessagesByStateId(List.of(state));

        // verifications
        assertThat(failures).containsOnly(Map.entry(STATE_ID, "AGENT_ERROR: unknown type"));
    }

    @Test
    void getFailedMessagesByStateId_deliveryFailedWithoutAFailure_failedStatusAsTheReason() {
        // setup
        PackageUpdateDeviceState state = state(STATE_ID, MAC, SoftwareActionStatus.IN_PROGRESS, longAgo);
        stubDeliveries(Set.of(deliveryId(MAC)), delivery(MAC, DeliveryStatus.FAILED, null, null));

        // execution
        Map<String, String> failures = reader.getFailedMessagesByStateId(List.of(state));

        // verifications
        assertThat(failures).containsOnly(Map.entry(STATE_ID, "FAILED"));
    }

    @Test
    void getFailedMessagesByStateId_noDeliveryRowWithinTheGrace_none() {
        // setup
        PackageUpdateDeviceState state = state(STATE_ID, MAC, SoftwareActionStatus.IN_PROGRESS, now);
        stubDeliveries(Set.of(deliveryId(MAC)));

        // execution
        Map<String, String> failures = reader.getFailedMessagesByStateId(List.of(state));

        // verifications
        assertThat(failures).isEmpty();
    }

    @Test
    void getFailedMessagesByStateId_noDeliveryRowPastTheGrace_notDelivered() {
        // setup
        Instant pastTheGrace = now.minus(PackageAdoptDeliveryFailureReader.DELIVERY_ROW_GRACE).minusSeconds(5);
        PackageUpdateDeviceState state = state(STATE_ID, MAC, SoftwareActionStatus.IN_PROGRESS, pastTheGrace);
        stubDeliveries(Set.of(deliveryId(MAC)));

        // execution
        Map<String, String> failures = reader.getFailedMessagesByStateId(List.of(state));

        // verifications
        assertThat(failures).containsOnly(Map.entry(STATE_ID, PackageAdoptDeliveryFailureReader.NOT_DELIVERED_ERROR));
    }

    @Test
    void getFailedMessagesByStateId_finishedStates_noneAndNoEngineRead() {
        // setup
        List<PackageUpdateDeviceState> states = List.of(
                state(STATE_ID, MAC, SoftwareActionStatus.COMPLETED, longAgo),
                state(OTHER_STATE_ID, OTHER_MAC, SoftwareActionStatus.FAILED, longAgo));

        // execution
        Map<String, String> failures = reader.getFailedMessagesByStateId(states);

        // verifications
        assertThat(failures).isEmpty();
        verifyNoInteractions(machineDeliveryRepository);
    }

    @Test
    void getFailedMessagesByStateId_severalInProgress_oneEngineReadForAllOfThem() {
        // setup
        List<PackageUpdateDeviceState> states = List.of(
                state(STATE_ID, MAC, SoftwareActionStatus.IN_PROGRESS, longAgo),
                state(OTHER_STATE_ID, OTHER_MAC, SoftwareActionStatus.IN_PROGRESS, now));
        stubDeliveries(Set.of(deliveryId(MAC), deliveryId(OTHER_MAC)),
                delivery(MAC, DeliveryStatus.FAILED, DeliveryFailure.TIMEOUT, null));

        // execution
        Map<String, String> failures = reader.getFailedMessagesByStateId(states);

        // verifications
        assertThat(failures).containsOnly(Map.entry(STATE_ID, "TIMEOUT"));
        verify(machineDeliveryRepository).findAllById(anyIterable());
    }

    private void stubDeliveries(Set<String> ids, MachineDelivery... deliveries) {
        when(machineDeliveryRepository.findAllById(argThat(
                (Iterable<String> given) -> Set.copyOf((List<String>) given).equals(ids))))
                .thenReturn(List.of(deliveries));
    }

    private static PackageUpdateDeviceState state(String id, String machineId, SoftwareActionStatus status,
                                                  Instant createdAt) {
        return PackageUpdateDeviceState.builder()
                .id(id)
                .requestId(REQUEST_ID)
                .machineId(machineId)
                .status(status)
                .createdAt(createdAt)
                .build();
    }

    private static MachineDelivery delivery(String machineId, DeliveryStatus status, DeliveryFailure failure,
                                            String error) {
        return MachineDelivery.builder()
                .id(deliveryId(machineId))
                .type(DeliveryType.PACKAGE_ADOPT)
                .targetId(REQUEST_ID)
                .machineId(machineId)
                .status(status)
                .failure(failure)
                .error(error)
                .build();
    }

    private static String deliveryId(String machineId) {
        return DeliveryId.of(DeliveryType.PACKAGE_ADOPT, REQUEST_ID, machineId);
    }
}
