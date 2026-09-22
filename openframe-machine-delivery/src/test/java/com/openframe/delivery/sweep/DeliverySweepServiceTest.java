package com.openframe.delivery.sweep;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryTestPolicies;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import com.openframe.delivery.spec.TestPayload;
import com.openframe.delivery.spec.TestSeed;
import com.openframe.delivery.sweep.MachineOnlineStatus.Lookup;
import com.openframe.delivery.track.DeliveryId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.openframe.delivery.config.DeliveryTestPolicies.ACK_THRESHOLD;
import static com.openframe.delivery.config.DeliveryTestPolicies.BACKOFF_MULTIPLIER;
import static com.openframe.delivery.config.DeliveryTestPolicies.BATCH_SIZE;
import static com.openframe.delivery.config.DeliveryTestPolicies.MAX_ATTEMPTS;
import static com.openframe.delivery.config.DeliveryTestPolicies.MAX_RETRY_INTERVAL;
import static com.openframe.delivery.config.DeliveryTestPolicies.RECONNECT_WINDOW;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliverySweepServiceTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String OTHER_MACHINE_ID = "mach-43";
    private static final String TARGET_ID = "fleetmdm-agent";
    private static final String PAYLOAD_JSON = "{\"value\":\"fleetmdm-agent\"}";
    private static final String CORRUPT_JSON = "not-json";
    private static final long TWO_DAYS_SECONDS = 172_800L;
    private static final long ONE_MINUTE_SECONDS = 60L;
    private static final long FIRST_RETRY_DELAY = ACK_THRESHOLD * BACKOFF_MULTIPLIER;
    private static final long CLOCK_SLACK_SECONDS = 5L;
    private static final int MANY_ATTEMPTS_ALLOWED = 10;
    private static final int ATTEMPTS_PAST_CAP = 5;
    private static final int NO_ATTEMPTS = 0;

    @Mock private MachineDeliveryRepository repository;
    @Mock private MachineOnlineStatus machineOnlineStatus;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryCloser closer;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliverySpec<TestSeed, TestPayload> spec;

    @Captor private ArgumentCaptor<TestPayload> payloadCaptor;
    @Captor private ArgumentCaptor<Instant> dueAtCaptor;

    private DeliverySweepService service;

    private DeliveryProperties properties;
    private MachineDelivery delivery;
    private Instant dispatchedAt;

    @BeforeEach
    void setUp() {
        dispatchedAt = Instant.now().minusSeconds(ACK_THRESHOLD * 2);
        delivery = row(MACHINE_ID, PAYLOAD_JSON);
        properties = DeliveryTestPolicies.properties();
        service = new DeliverySweepService(repository, machineOnlineStatus, registry, properties, closer, metrics, new ObjectMapper());
    }

    @Test
    void retryPending_onlineWithAttemptsLeft_publishedThenCountedWithBackoff() {
        // setup
        Instant before = Instant.now();
        stubDue(delivery);
        stubMachine(DeviceStatus.ONLINE);
        stubSpec();
        when(repository.markRepublished(eq(delivery.getId()), eq(DeliveryStatus.UNACKED), eq(dispatchedAt), eq(NO_ATTEMPTS), dueAtCaptor.capture())).thenReturn(true);

        // execution
        service.retryPending();

        // verifications
        verify(spec).publish(eq(MACHINE_ID), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue().getValue()).isEqualTo(TARGET_ID);
        assertThat(dueAtCaptor.getValue())
                .isAfterOrEqualTo(before.plusSeconds(FIRST_RETRY_DELAY))
                .isBefore(before.plusSeconds(FIRST_RETRY_DELAY + CLOCK_SLACK_SECONDS));
        verify(metrics).recordRetried(DeliveryType.TOOL_INSTALLATION);
        verifyNoInteractions(closer);
    }

    @Test
    void retryPending_manyAttemptsBehind_backoffCappedAtMaxRetryInterval() {
        // setup
        Instant before = Instant.now();
        properties.getDefaults().setMaxAttempts(MANY_ATTEMPTS_ALLOWED);
        delivery.setAttempts(ATTEMPTS_PAST_CAP);
        stubDue(delivery);
        stubMachine(DeviceStatus.ONLINE);
        stubSpec();
        when(repository.markRepublished(eq(delivery.getId()), eq(DeliveryStatus.UNACKED), eq(dispatchedAt), eq(ATTEMPTS_PAST_CAP), dueAtCaptor.capture())).thenReturn(true);

        // execution
        service.retryPending();

        // verifications
        assertThat(dueAtCaptor.getValue())
                .isAfterOrEqualTo(before.plusSeconds(MAX_RETRY_INTERVAL))
                .isBefore(before.plusSeconds(MAX_RETRY_INTERVAL + CLOCK_SLACK_SECONDS));
    }

    @Test
    void retryPending_publishThrows_attemptNotCountedRowPostponedWithoutErrorCount() {
        // setup
        Instant before = Instant.now();
        stubDue(delivery);
        stubMachine(DeviceStatus.ONLINE);
        stubSpec();
        doThrow(new IllegalStateException("nats down")).when(spec).publish(eq(MACHINE_ID), any(TestPayload.class));

        // execution
        service.retryPending();

        // verifications
        verify(repository, never()).markRepublished(eq(delivery.getId()), eq(DeliveryStatus.UNACKED), eq(dispatchedAt), eq(NO_ATTEMPTS), any(Instant.class));
        verify(repository).postpone(eq(delivery.getId()), eq(DeliveryStatus.UNACKED), eq(dispatchedAt), dueAtCaptor.capture());
        assertThat(dueAtCaptor.getValue())
                .isAfterOrEqualTo(before.plusSeconds(MAX_RETRY_INTERVAL))
                .isBefore(before.plusSeconds(MAX_RETRY_INTERVAL + CLOCK_SLACK_SECONDS));
        verify(metrics).recordPublishFailed(DeliveryType.TOOL_INSTALLATION);
        verify(metrics, never()).recordRowError();
        verify(metrics, never()).recordRetried(DeliveryType.TOOL_INSTALLATION);
        verifyNoInteractions(closer);
    }

    @Test
    void retryPending_typeWithoutSpec_errorCountedAndRowPostponed() {
        // setup
        stubDue(delivery);
        stubMachine(DeviceStatus.ONLINE);
        when(registry.require(DeliveryType.TOOL_INSTALLATION))
                .thenThrow(new IllegalArgumentException("No spec registered for delivery type: TOOL_INSTALLATION"));

        // execution
        service.retryPending();

        // verifications
        verify(repository).postponeAfterError(eq(delivery.getId()), eq(DeliveryStatus.UNACKED), eq(dispatchedAt), any(Instant.class));
        verify(metrics).recordRowError();
        verifyNoInteractions(closer, spec);
    }

    @Test
    void retryPending_errorsReachMaxAttempts_failedError() {
        // setup
        delivery.setErrors(MAX_ATTEMPTS - 1);
        stubDue(delivery);
        stubMachine(DeviceStatus.ONLINE);
        when(registry.require(DeliveryType.TOOL_INSTALLATION))
                .thenThrow(new IllegalArgumentException("No spec registered for delivery type: TOOL_INSTALLATION"));

        // execution
        service.retryPending();

        // verifications
        verify(closer).fail(eq(delivery), eq(DeliveryFailure.ERROR), eq(DeliveryStatus.UNACKED), any(Instant.class));
        verify(repository, never()).postponeAfterError(eq(delivery.getId()), eq(DeliveryStatus.UNACKED), eq(dispatchedAt), any(Instant.class));
    }

    @Test
    void retryPending_rowMovedOnWhilePublishing_publishedButNotCounted() {
        // setup
        stubDue(delivery);
        stubMachine(DeviceStatus.ONLINE);
        stubSpec();
        when(repository.markRepublished(eq(delivery.getId()), eq(DeliveryStatus.UNACKED), eq(dispatchedAt), eq(NO_ATTEMPTS), any(Instant.class))).thenReturn(false);

        // execution
        service.retryPending();

        // verifications
        verify(spec).publish(eq(MACHINE_ID), any(TestPayload.class));
        verify(metrics, never()).recordRetried(DeliveryType.TOOL_INSTALLATION);
        verifyNoInteractions(closer);
    }

    @Test
    void retryPending_onlineAttemptsExhausted_failedExhaustedOnlyIfStillUnacked() {
        // setup
        delivery.setAttempts(MAX_ATTEMPTS);
        stubDue(delivery);
        stubMachine(DeviceStatus.ONLINE);

        // execution
        service.retryPending();

        // verifications
        verify(closer).fail(eq(delivery), eq(DeliveryFailure.EXHAUSTED), eq(DeliveryStatus.UNACKED), any(Instant.class));
        verifyNoInteractions(registry, metrics);
    }

    @Test
    void retryPending_offlineFarFromWindowEnd_parkedUntilNextRecheck() {
        // setup
        Instant before = Instant.now();
        stubDue(delivery);
        stubMachine(DeviceStatus.OFFLINE);

        // execution
        service.retryPending();

        // verifications
        verify(repository).park(eq(delivery.getId()), eq(DeliveryStatus.UNACKED), eq(dispatchedAt), dueAtCaptor.capture());
        assertThat(dueAtCaptor.getValue())
                .isAfterOrEqualTo(before.plusSeconds(MAX_RETRY_INTERVAL))
                .isBefore(before.plusSeconds(MAX_RETRY_INTERVAL + CLOCK_SLACK_SECONDS));
        verifyNoInteractions(registry, closer, metrics);
    }

    @Test
    void retryPending_offlineCloseToWindowEnd_parkedUntilWindowEnd() {
        // setup
        Instant recently = Instant.now().minusSeconds(RECONNECT_WINDOW - ONE_MINUTE_SECONDS);
        delivery.setDispatchedAt(recently);
        stubDue(delivery);
        stubMachine(DeviceStatus.OFFLINE);

        // execution
        service.retryPending();

        // verifications
        verify(repository).park(delivery.getId(), DeliveryStatus.UNACKED, recently, recently.plusSeconds(RECONNECT_WINDOW));
    }

    @Test
    void retryPending_machineStillPendingFirstHeartbeat_parkedLikeOffline() {
        // setup
        stubDue(delivery);
        stubMachine(DeviceStatus.PENDING);

        // execution
        service.retryPending();

        // verifications
        verify(repository).park(eq(delivery.getId()), eq(DeliveryStatus.UNACKED), eq(dispatchedAt), any(Instant.class));
        verifyNoInteractions(registry, closer, metrics);
    }

    @Test
    void retryPending_machineDocumentMissing_parkedNotCancelled() {
        // setup
        stubDue(delivery);
        when(machineOnlineStatus.lookup(Set.of(MACHINE_ID))).thenReturn(new Lookup(Map.of()));

        // execution
        service.retryPending();

        // verifications
        verify(repository).park(eq(delivery.getId()), eq(DeliveryStatus.UNACKED), eq(dispatchedAt), any(Instant.class));
        verifyNoInteractions(registry, closer, metrics);
    }

    @Test
    void retryPending_offlineReconnectWindowOver_failedOffline() {
        // setup
        Instant twoDaysAgo = Instant.now().minusSeconds(TWO_DAYS_SECONDS);
        delivery.setDispatchedAt(twoDaysAgo);
        stubDue(delivery);
        stubMachine(DeviceStatus.OFFLINE);

        // execution
        service.retryPending();

        // verifications
        verify(closer).fail(eq(delivery), eq(DeliveryFailure.OFFLINE), eq(DeliveryStatus.UNACKED), any(Instant.class));
        verify(repository, never()).park(eq(delivery.getId()), eq(DeliveryStatus.UNACKED), eq(twoDaysAgo), any(Instant.class));
    }

    @Test
    void retryPending_offlineWithSkipBehavior_cancelledNotFailed() {
        // setup
        properties.getDefaults().setOfflineBehavior(DeliveryOfflineBehavior.SKIP);
        stubDue(delivery);
        stubMachine(DeviceStatus.OFFLINE);

        // execution
        service.retryPending();

        // verifications
        verify(closer).cancel(eq(delivery), eq(DeliveryStatus.UNACKED), any(String.class), any(Instant.class));
        verify(closer, never()).fail(eq(delivery), any(DeliveryFailure.class), eq(DeliveryStatus.UNACKED), any(Instant.class));
        verifyNoInteractions(registry, metrics);
    }

    @Test
    void retryPending_machineDeleted_cancelled() {
        // setup
        stubDue(delivery);
        stubMachine(DeviceStatus.DELETED);

        // execution
        service.retryPending();

        // verifications
        verify(closer).cancel(eq(delivery), eq(DeliveryStatus.UNACKED), any(String.class), any(Instant.class));
        verifyNoInteractions(registry, metrics);
    }

    @Test
    void retryPending_oneRowCorrupt_corruptCountedAndPostponedOtherRepublished() {
        // setup
        MachineDelivery corrupt = row(OTHER_MACHINE_ID, CORRUPT_JSON);
        stubDue(corrupt, delivery);
        Set<String> both = Set.of(OTHER_MACHINE_ID, MACHINE_ID);
        Map<String, DeviceStatus> bothOnline = Map.of(OTHER_MACHINE_ID, DeviceStatus.ONLINE, MACHINE_ID, DeviceStatus.ONLINE);
        when(machineOnlineStatus.lookup(both)).thenReturn(new Lookup(bothOnline));
        stubSpec();
        when(repository.markRepublished(eq(delivery.getId()), eq(DeliveryStatus.UNACKED), eq(dispatchedAt), eq(NO_ATTEMPTS), any(Instant.class))).thenReturn(true);

        // execution
        service.retryPending();

        // verifications
        verify(repository).postponeAfterError(eq(corrupt.getId()), eq(DeliveryStatus.UNACKED), eq(dispatchedAt), any(Instant.class));
        verify(spec).publish(eq(MACHINE_ID), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue().getValue()).isEqualTo(TARGET_ID);
        verify(spec, never()).publish(eq(OTHER_MACHINE_ID), any(TestPayload.class));
        verify(metrics).recordRetried(DeliveryType.TOOL_INSTALLATION);
        verify(metrics).recordRowError();
    }

    @Test
    void retryPending_nothingDue_machinesNotLookedUp() {
        // setup
        stubDue();

        // execution
        service.retryPending();

        // verifications
        verifyNoInteractions(machineOnlineStatus, registry, closer, metrics);
    }

    private MachineDelivery row(String machineId, String payloadJson) {
        return MachineDelivery.builder()
                .id(DeliveryId.of(DeliveryType.TOOL_INSTALLATION, TARGET_ID, machineId))
                .type(DeliveryType.TOOL_INSTALLATION)
                .targetId(TARGET_ID)
                .machineId(machineId)
                .status(DeliveryStatus.PENDING)
                .attempts(NO_ATTEMPTS)
                .errors(0)
                .payloadJson(payloadJson)
                .dispatchedAt(dispatchedAt)
                .dueAt(dispatchedAt.plusSeconds(ACK_THRESHOLD))
                .build();
    }

    private void stubDue(MachineDelivery... rows) {
        when(repository.findDue(eq(DeliveryStatus.PENDING), any(Instant.class), eq(BATCH_SIZE))).thenReturn(List.of(rows));
    }

    private void stubMachine(DeviceStatus status) {
        Lookup lookup = new Lookup(Map.of(MACHINE_ID, status));
        when(machineOnlineStatus.lookup(Set.of(MACHINE_ID))).thenReturn(lookup);
    }

    private void stubSpec() {
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
        when(spec.getPayloadClass()).thenReturn(TestPayload.class);
    }
}
