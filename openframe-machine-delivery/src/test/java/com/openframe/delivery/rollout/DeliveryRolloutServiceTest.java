package com.openframe.delivery.rollout;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryRolloutStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDeliveryRollout;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.delivery.MachineDeliveryRolloutRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryTestPolicies;
import com.openframe.delivery.dispatch.DeliveryPayloadJson;
import com.openframe.delivery.dispatch.DeliverySink;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import com.openframe.delivery.spec.TestPayload;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Limit;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryRolloutServiceTest {

    private static final String ROLLOUT_ID = "CLIENT_UPDATE:openframe-client";
    private static final String TARGET_ID = "openframe-client";
    private static final int SEQUENCE = 7;
    private static final int BATCH_SIZE = 2;
    private static final Set<DeviceStatus> DELIVERABLE = EnumSet.of(DeviceStatus.ONLINE, DeviceStatus.OFFLINE);

    @Mock private MachineDeliveryRolloutRepository repository;
    @Mock private MachineRepository machineRepository;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliverySink sink;
    @Mock private DeliverySpec<DeliverySeed, DeliveryPayload> spec;

    @Captor private ArgumentCaptor<DeliveryRequest<?>> requestCaptor;

    private DeliveryRolloutService service;
    private MachineDeliveryRollout rollout;

    @BeforeEach
    void setUp() {
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        properties.getSweep().setBatchSize(BATCH_SIZE);
        service = new DeliveryRolloutService(repository, machineRepository, registry, properties, new DeliveryPayloadJson(new ObjectMapper()), sink);
        TestPayload payload = new TestPayload();
        payload.setValue("1.5.11");
        payload.setDelivery(new DeliveryRef(DeliveryType.CLIENT_UPDATE, TARGET_ID, "d-rollout"));
        rollout = MachineDeliveryRollout.builder()
                .id(ROLLOUT_ID)
                .type(DeliveryType.CLIENT_UPDATE)
                .targetId(TARGET_ID)
                .payloadJson("{\"value\":\"1.5.11\",\"delivery\":{\"type\":\"CLIENT_UPDATE\",\"targetId\":\"openframe-client\",\"dispatchId\":\"d-rollout\"}}")
                .sequence(SEQUENCE)
                .status(DeliveryRolloutStatus.RUNNING)
                .cursor("")
                .build();
        when(repository.findByStatus(DeliveryRolloutStatus.RUNNING)).thenReturn(List.of(rollout));
        doReturn(spec).when(registry).require(DeliveryType.CLIENT_UPDATE);
        doReturn(DELIVERABLE).when(spec).getDeliverableStatuses();
        doReturn(TestPayload.class).when(spec).getPayloadClass();
    }

    @Test
    void advance_fullBatch_everyMachineDispatchedWithTheRolloutSequenceAndCursorMoved() {
        // setup
        when(machineRepository.findByStatusInAndMachineIdGreaterThanOrderByMachineIdAsc(DELIVERABLE, "", Limit.of(BATCH_SIZE)))
                .thenReturn(List.of(machine("m-1"), machine("m-2")));

        // execution
        service.advance();

        // verifications
        verify(sink, times(2)).accept(requestCaptor.capture());
        List<DeliveryRequest<?>> requests = requestCaptor.getAllValues();
        assertThat(requests).extracting(DeliveryRequest::getMachineId).containsExactly("m-1", "m-2");
        assertThat(requests).extracting(DeliveryRequest::getTargetId).containsOnly(TARGET_ID);
        DeliveryRef first = requests.get(0).getPayload().getDelivery();
        DeliveryRef second = requests.get(1).getPayload().getDelivery();
        assertThat(first.getSequence()).isEqualTo(SEQUENCE);
        assertThat(second.getSequence()).isEqualTo(SEQUENCE);
        assertThat(first.getDispatchId()).isNotEqualTo(second.getDispatchId()).isNotEqualTo("d-rollout");
        verify(repository).advance(ROLLOUT_ID, SEQUENCE, "m-2", 2);
        verify(repository, never()).finish(any(), anyInt(), anyInt());
    }

    @Test
    void advance_shortBatch_lastMachinesDispatchedAndRolloutFinished() {
        // setup
        when(machineRepository.findByStatusInAndMachineIdGreaterThanOrderByMachineIdAsc(DELIVERABLE, "", Limit.of(BATCH_SIZE)))
                .thenReturn(List.of(machine("m-9")));

        // execution
        service.advance();

        // verifications
        verify(sink).accept(any());
        verify(repository).finish(ROLLOUT_ID, SEQUENCE, 1);
        verify(repository, never()).advance(any(), anyInt(), any(), anyInt());
    }

    @Test
    void advance_batchFails_cursorKeptSoTheBatchIsRepeatedNextTick() {
        // setup
        when(machineRepository.findByStatusInAndMachineIdGreaterThanOrderByMachineIdAsc(DELIVERABLE, "", Limit.of(BATCH_SIZE)))
                .thenReturn(List.of(machine("m-1"), machine("m-2")));
        doThrow(new IllegalStateException("mongo down")).when(sink).accept(any());

        // execution
        service.advance();

        // verifications
        verify(repository, never()).advance(any(), anyInt(), any(), anyInt());
        verify(repository, never()).finish(any(), anyInt(), anyInt());
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setMachineId(machineId);
        return machine;
    }
}
