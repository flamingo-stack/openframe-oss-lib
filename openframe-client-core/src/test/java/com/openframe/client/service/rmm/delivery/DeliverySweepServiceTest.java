package com.openframe.client.service.rmm.delivery;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.metrics.DeliveryMetrics;
import com.openframe.client.service.rmm.delivery.DeliveryProperties.Policy;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.delivery.DeliveryFailure;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.DeliveryStatus;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.nats.model.ToolInstallationMessage;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.MachineDeliveryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliverySweepServiceTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TOOL_AGENT_ID = "tactical-agent";
    private static final String PAYLOAD_JSON = "{\"toolAgentId\":\"tactical-agent\"}";
    private static final long ACK_THRESHOLD = 30L;
    private static final int MAX_ATTEMPTS = 3;
    private static final long RECONNECT_WINDOW = 86_400L;
    private static final long RESULT_TIMEOUT = 600L;
    private static final long TTL = 604_800L;
    private static final long TWO_DAYS_SECONDS = 172_800L;

    @Mock private MachineDeliveryRepository repository;
    @Mock private MachineRepository machineRepository;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryFailureRecorder failureRecorder;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliverySpec<ToolInstallationMessage> spec;

    @Captor private ArgumentCaptor<ToolInstallationMessage> payloadCaptor;

    private DeliverySweepService service;

    private DeliveryProperties properties;
    private MachineDelivery delivery;
    private Machine offlineMachine;

    @BeforeEach
    void setUp() {
        Policy defaults = new Policy();
        defaults.setAckThresholdSeconds(ACK_THRESHOLD);
        defaults.setMaxAttempts(MAX_ATTEMPTS);
        defaults.setOfflineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        defaults.setReconnectWindowSeconds(RECONNECT_WINDOW);
        defaults.setResultTimeoutSeconds(RESULT_TIMEOUT);
        defaults.setTtlSeconds(TTL);
        properties = new DeliveryProperties();
        properties.setDefaults(defaults);

        Instant dispatchedAt = Instant.now().minusSeconds(ACK_THRESHOLD * 2);
        delivery = MachineDelivery.builder()
                .id(MachineDelivery.id(DeliveryKind.TOOL_INSTALLATION, TOOL_AGENT_ID, MACHINE_ID))
                .kind(DeliveryKind.TOOL_INSTALLATION)
                .targetId(TOOL_AGENT_ID)
                .machineId(MACHINE_ID)
                .status(DeliveryStatus.PENDING)
                .attempts(0)
                .payloadJson(PAYLOAD_JSON)
                .dispatchedAt(dispatchedAt)
                .lastAttemptAt(dispatchedAt)
                .build();

        offlineMachine = new Machine();
        offlineMachine.setMachineId(MACHINE_ID);
        offlineMachine.setStatus(DeviceStatus.OFFLINE);

        service = new DeliverySweepService(repository, machineRepository, registry, properties, failureRecorder, metrics, new ObjectMapper());
    }

    @Test
    void retryPending_onlineWithAttemptsLeft_republishedAndAttemptCounted() {
        // setup
        stubOneStuckDelivery();
        stubMachineOnline();
        doReturn(spec).when(registry).require(DeliveryKind.TOOL_INSTALLATION);
        when(spec.getPayloadClass()).thenReturn(ToolInstallationMessage.class);

        // execution
        service.retryPending();

        // verifications
        verify(spec).publish(eq(MACHINE_ID), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue().getToolAgentId()).isEqualTo(TOOL_AGENT_ID);
        assertThat(delivery.getAttempts()).isEqualTo(1);
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        verify(repository).save(delivery);
        verify(metrics).recordRetried(DeliveryKind.TOOL_INSTALLATION);
        verifyNoInteractions(failureRecorder);
    }

    @Test
    void retryPending_onlineAttemptsExhausted_failedExhausted() {
        // setup
        delivery.setAttempts(MAX_ATTEMPTS);
        stubOneStuckDelivery();
        stubMachineOnline();

        // execution
        service.retryPending();

        // verifications
        verify(failureRecorder).fail(eq(delivery), eq(DeliveryFailure.EXHAUSTED), any(Instant.class));
        verify(repository, never()).save(delivery);
        verifyNoInteractions(metrics);
    }

    @Test
    void retryPending_offlineInsideReconnectWindow_leftPendingWithoutAttempt() {
        // setup
        stubOneStuckDelivery();
        stubMachineOffline();

        // execution
        service.retryPending();

        // verifications
        assertThat(delivery.getAttempts()).isZero();
        verify(repository, never()).save(delivery);
        verifyNoInteractions(failureRecorder);
        verifyNoInteractions(metrics);
    }

    @Test
    void retryPending_offlineReconnectWindowOver_failedOffline() {
        // setup
        Instant twoDaysAgo = Instant.now().minusSeconds(TWO_DAYS_SECONDS);
        delivery.setDispatchedAt(twoDaysAgo);
        stubOneStuckDelivery();
        stubMachineOffline();

        // execution
        service.retryPending();

        // verifications
        verify(failureRecorder).fail(eq(delivery), eq(DeliveryFailure.OFFLINE), any(Instant.class));
    }

    @Test
    void retryPending_offlineWithRowSkipOverride_failedOfflineImmediately() {
        // setup
        delivery.setOfflineBehavior(ScheduleOfflineBehavior.SKIP);
        stubOneStuckDelivery();
        stubMachineOffline();

        // execution
        service.retryPending();

        // verifications
        verify(failureRecorder).fail(eq(delivery), eq(DeliveryFailure.OFFLINE), any(Instant.class));
    }

    @Test
    void retryPending_nothingStuck_machinesNotQueried() {
        // setup
        when(registry.kinds()).thenReturn(Set.of(DeliveryKind.TOOL_INSTALLATION));
        when(repository.findByKindAndStatusAndLastAttemptAtBefore(eq(DeliveryKind.TOOL_INSTALLATION), eq(DeliveryStatus.PENDING), any(Instant.class)))
                .thenReturn(List.of());

        // execution
        service.retryPending();

        // verifications
        verifyNoInteractions(machineRepository);
        verifyNoInteractions(failureRecorder);
    }

    private void stubOneStuckDelivery() {
        when(registry.kinds()).thenReturn(Set.of(DeliveryKind.TOOL_INSTALLATION));
        when(repository.findByKindAndStatusAndLastAttemptAtBefore(eq(DeliveryKind.TOOL_INSTALLATION), eq(DeliveryStatus.PENDING), any(Instant.class)))
                .thenReturn(List.of(delivery));
    }

    private void stubMachineOnline() {
        when(machineRepository.findByMachineIdInAndStatus(Set.of(MACHINE_ID), DeviceStatus.OFFLINE)).thenReturn(List.of());
    }

    private void stubMachineOffline() {
        when(machineRepository.findByMachineIdInAndStatus(Set.of(MACHINE_ID), DeviceStatus.OFFLINE)).thenReturn(List.of(offlineMachine));
    }
}
