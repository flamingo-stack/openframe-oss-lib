package com.openframe.delivery;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
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

import static com.openframe.delivery.DeliveryTestPolicies.ACK_THRESHOLD;
import static com.openframe.delivery.DeliveryTestPolicies.MAX_ATTEMPTS;
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
    private static final String TARGET_ID = "tactical-agent";
    private static final String PAYLOAD_JSON = "{\"value\":\"tactical-agent\"}";
    private static final long TWO_DAYS_SECONDS = 172_800L;

    @Mock private MachineDeliveryRepository repository;
    @Mock private MachineOnlineStatus machineOnlineStatus;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryFailureRecorder failureRecorder;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliverySpec<TestPayload> spec;

    @Captor private ArgumentCaptor<TestPayload> payloadCaptor;

    private DeliverySweepService service;

    private MachineDelivery delivery;

    @BeforeEach
    void setUp() {
        Instant dispatchedAt = Instant.now().minusSeconds(ACK_THRESHOLD * 2);
        delivery = MachineDelivery.builder()
                .id(MachineDelivery.id(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID))
                .type(DeliveryType.TOOL_INSTALLATION)
                .targetId(TARGET_ID)
                .machineId(MACHINE_ID)
                .status(DeliveryStatus.PENDING)
                .attempts(0)
                .payloadJson(PAYLOAD_JSON)
                .dispatchedAt(dispatchedAt)
                .lastAttemptAt(dispatchedAt)
                .build();
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        service = new DeliverySweepService(repository, machineOnlineStatus, registry, properties, failureRecorder, metrics, new ObjectMapper());
    }

    @Test
    void retryPending_onlineWithAttemptsLeft_republishedAndAttemptCounted() {
        // setup
        stubOneStuckDelivery();
        stubMachineOnline();
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
        when(spec.getPayloadClass()).thenReturn(TestPayload.class);

        // execution
        service.retryPending();

        // verifications
        verify(spec).publish(eq(MACHINE_ID), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue().getValue()).isEqualTo(TARGET_ID);
        assertThat(delivery.getAttempts()).isEqualTo(1);
        assertThat(delivery.getStatus()).isEqualTo(DeliveryStatus.PENDING);
        verify(repository).save(delivery);
        verify(metrics).recordRetried(DeliveryType.TOOL_INSTALLATION);
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
    void retryPending_nothingStuck_onlineStatusNotQueried() {
        // setup
        when(registry.types()).thenReturn(Set.of(DeliveryType.TOOL_INSTALLATION));
        when(repository.findByTypeAndStatusAndLastAttemptAtBefore(eq(DeliveryType.TOOL_INSTALLATION), eq(DeliveryStatus.PENDING), any(Instant.class)))
                .thenReturn(List.of());

        // execution
        service.retryPending();

        // verifications
        verifyNoInteractions(machineOnlineStatus);
        verifyNoInteractions(failureRecorder);
    }

    private void stubOneStuckDelivery() {
        when(registry.types()).thenReturn(Set.of(DeliveryType.TOOL_INSTALLATION));
        when(repository.findByTypeAndStatusAndLastAttemptAtBefore(eq(DeliveryType.TOOL_INSTALLATION), eq(DeliveryStatus.PENDING), any(Instant.class)))
                .thenReturn(List.of(delivery));
    }

    private void stubMachineOnline() {
        when(machineOnlineStatus.offline(Set.of(MACHINE_ID))).thenReturn(Set.of());
    }

    private void stubMachineOffline() {
        when(machineOnlineStatus.offline(Set.of(MACHINE_ID))).thenReturn(Set.of(MACHINE_ID));
    }
}
