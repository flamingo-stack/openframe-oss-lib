package com.openframe.delivery.rollout;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import com.openframe.data.document.delivery.DeliveryRolloutStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDeliveryRollout;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.delivery.MachineDeliveryRolloutRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.AgentVersionService;
import com.openframe.delivery.agent.AgentVersionFloor;
import com.openframe.delivery.agent.AgentVersionFloorResolver;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryTestPolicies;
import com.openframe.delivery.dispatch.DeliveryPayloadJson;
import com.openframe.delivery.dispatch.DeliverySink;
import com.openframe.delivery.metrics.DeliveryMetrics;
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
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.domain.Limit;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryRolloutServiceTest {

    private static final String ROLLOUT_ID = "t-1:CLIENT_UPDATE:openframe-client";
    private static final String TARGET_ID = "openframe-client";
    private static final int SEQUENCE = 7;
    private static final int BATCH_SIZE = 2;
    private static final Set<DeviceStatus> DELIVERABLE = EnumSet.of(DeviceStatus.ONLINE, DeviceStatus.OFFLINE);

    @Mock private MachineDeliveryRolloutRepository repository;
    @Mock private MachineRepository machineRepository;
    @Mock private AgentVersionService agentVersions;
    @Mock private AgentVersionFloorResolver floors;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliverySink sink;
    @Mock private DeliverySpec<DeliverySeed, DeliveryPayload> spec;
    @Mock private DeliveryMetrics metrics;

    @Captor private ArgumentCaptor<DeliveryRequest<?>> requestCaptor;

    private DeliveryRolloutService service;
    private MachineDeliveryRollout rollout;

    @BeforeEach
    void setUp() {
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        properties.getSweep().setBatchSize(BATCH_SIZE);
        service = new DeliveryRolloutService(repository, machineRepository, agentVersions, floors, registry, properties, new DeliveryPayloadJson(new JsonMapper()), sink, metrics);
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
                .cursor(DeliveryRolloutRecorder.BEFORE_FIRST_MACHINE)
                .startedAt(Instant.now())
                .build();
        when(repository.findByStatus(DeliveryRolloutStatus.RUNNING)).thenReturn(List.of(rollout));
        doReturn(spec).when(registry).require(DeliveryType.CLIENT_UPDATE);
        doReturn(DELIVERABLE).when(spec).getDeliverableStatuses();
        lenient().doReturn(TestPayload.class).when(spec).getPayloadClass();
        lenient().when(floors.of(DeliveryType.CLIENT_UPDATE)).thenReturn(AgentVersionFloor.EVERY_VERSION);
    }

    @Test
    void advance_fullBatch_everyMachineDispatchedWithTheRolloutSequenceAndCursorMoved() {
        // setup
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(DELIVERABLE, DeliveryRolloutRecorder.BEFORE_FIRST_MACHINE, Limit.of(BATCH_SIZE)))
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
        verify(repository).advance(ROLLOUT_ID, SEQUENCE, "id-m-2", 2);
        verify(repository, never()).finish(any(), anyInt(), anyInt());
        verify(metrics).recordRolloutMachines(DeliveryType.CLIENT_UPDATE, 2);
        verify(metrics, never()).recordRolloutFinished(any(), any());
    }

    @Test
    void advance_runningRollouts_countedPerTypeZeroForTheOthers() {
        // setup
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(DELIVERABLE, DeliveryRolloutRecorder.BEFORE_FIRST_MACHINE, Limit.of(BATCH_SIZE)))
                .thenReturn(List.of(machine("m-1")));

        // execution
        service.advance();

        // verifications
        verify(metrics).recordRolloutsRunning(DeliveryType.CLIENT_UPDATE, 1);
        verify(metrics).recordRolloutsRunning(DeliveryType.TOOL_UPDATE, 0);
        verify(metrics).recordRolloutsRunning(DeliveryType.CLIENT_FEATURE_FLAGS, 0);
    }

    @Test
    void advance_shortBatch_lastMachinesDispatchedAndRolloutFinished() {
        // setup
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(DELIVERABLE, DeliveryRolloutRecorder.BEFORE_FIRST_MACHINE, Limit.of(BATCH_SIZE)))
                .thenReturn(List.of(machine("m-9")));

        // execution
        service.advance();

        // verifications
        verify(sink).accept(any());
        verify(repository).finish(ROLLOUT_ID, SEQUENCE, 1);
        verify(repository, never()).advance(any(), anyInt(), any(), anyInt());
        verify(metrics).recordRolloutMachines(DeliveryType.CLIENT_UPDATE, 1);
        verify(metrics).recordRolloutFinished(eq(DeliveryType.CLIENT_UPDATE), any());
    }

    @Test
    void advance_mongoAwayMidBatch_cursorKeptSoTheBatchIsRepeatedNextTick() {
        // setup
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(DELIVERABLE, DeliveryRolloutRecorder.BEFORE_FIRST_MACHINE, Limit.of(BATCH_SIZE)))
                .thenReturn(List.of(machine("m-1"), machine("m-2")));
        doThrow(new DataAccessResourceFailureException("mongo down")).when(sink).accept(any());

        // execution
        service.advance();

        // verifications
        verify(repository, never()).advance(any(), anyInt(), any(), anyInt());
        verify(repository, never()).finish(any(), anyInt(), anyInt());
        verify(metrics).recordRolloutBatchFailed(DeliveryType.CLIENT_UPDATE);
        verify(metrics, never()).recordRolloutMachineSkipped(any());
    }

    @Test
    void advance_oneMachineFails_thatMachineSkippedAndCountedTheBatchGoesOn() {
        // setup
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(DELIVERABLE, DeliveryRolloutRecorder.BEFORE_FIRST_MACHINE, Limit.of(BATCH_SIZE)))
                .thenReturn(List.of(machine("m-1"), machine("m-2")));
        doThrow(new IllegalStateException("bad machine")).doNothing().when(sink).accept(any());

        // execution
        service.advance();

        // verifications
        verify(sink, times(2)).accept(any());
        verify(metrics).recordRolloutMachineSkipped(DeliveryType.CLIENT_UPDATE);
        verify(metrics, never()).recordRolloutBatchFailed(any());
        verify(repository).advance(ROLLOUT_ID, SEQUENCE, "id-m-2", 2);
    }

    @Test
    void advance_floorSet_machinesBelowItWalkedPastCursorStillMovesOverThem() {
        // setup
        when(floors.of(DeliveryType.CLIENT_UPDATE)).thenReturn(AgentVersionFloor.from("1.6.0"));
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(DELIVERABLE, DeliveryRolloutRecorder.BEFORE_FIRST_MACHINE, Limit.of(BATCH_SIZE)))
                .thenReturn(List.of(machine("m-1"), machine("m-2")));
        when(agentVersions.findAll(List.of("m-1", "m-2"))).thenReturn(Map.of("m-1", "1.5.9", "m-2", "1.6.0"));

        // execution
        service.advance();

        // verifications
        verify(sink).accept(requestCaptor.capture());
        assertThat(requestCaptor.getValue().getMachineId()).isEqualTo("m-2");
        verify(repository).advance(ROLLOUT_ID, SEQUENCE, "id-m-2", 1);
        verify(metrics).recordRolloutMachines(DeliveryType.CLIENT_UPDATE, 1);
        verify(metrics, never()).recordRolloutMachineSkipped(any());
    }

    @Test
    void advance_floorClosed_nobodyDispatchedTheRolloutStillFinishes() {
        // setup
        when(floors.of(DeliveryType.CLIENT_UPDATE)).thenReturn(AgentVersionFloor.CLOSED);
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(DELIVERABLE, DeliveryRolloutRecorder.BEFORE_FIRST_MACHINE, Limit.of(BATCH_SIZE)))
                .thenReturn(List.of(machine("m-9")));

        // execution
        service.advance();

        // verifications
        verify(sink, never()).accept(any());
        verify(repository).finish(ROLLOUT_ID, SEQUENCE, 0);
    }

    @Test
    void advance_noFloor_versionsNeverLookedUp() {
        // setup
        when(machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(DELIVERABLE, DeliveryRolloutRecorder.BEFORE_FIRST_MACHINE, Limit.of(BATCH_SIZE)))
                .thenReturn(List.of(machine("m-1")));

        // execution
        service.advance();

        // verifications
        verify(sink).accept(any());
        verifyNoInteractions(agentVersions);
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setId("id-" + machineId);
        machine.setMachineId(machineId);
        return machine;
    }
}
