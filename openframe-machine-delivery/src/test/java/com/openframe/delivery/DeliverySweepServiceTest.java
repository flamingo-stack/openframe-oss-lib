package com.openframe.delivery;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.MachineOnlineStatus.Lookup;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.openframe.delivery.DeliveryTestPolicies.ACK_THRESHOLD;
import static com.openframe.delivery.DeliveryTestPolicies.BACKOFF_MULTIPLIER;
import static com.openframe.delivery.DeliveryTestPolicies.BATCH_SIZE;
import static com.openframe.delivery.DeliveryTestPolicies.MAX_ATTEMPTS;
import static com.openframe.delivery.DeliveryTestPolicies.MAX_RETRY_INTERVAL;
import static com.openframe.delivery.DeliveryTestPolicies.RECONNECT_WINDOW;
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
    private static final String OTHER_MACHINE_ID = "mach-43";
    private static final String TARGET_ID = "tactical-agent";
    private static final String PAYLOAD_JSON = "{\"value\":\"tactical-agent\"}";
    private static final String CORRUPT_JSON = "not-json";
    private static final long TWO_DAYS_SECONDS = 172_800L;
    private static final long FIRST_RETRY_DELAY = ACK_THRESHOLD * BACKOFF_MULTIPLIER;
    private static final long CLOCK_SLACK_SECONDS = 5L;
    private static final int MANY_ATTEMPTS_ALLOWED = 10;
    private static final int ATTEMPTS_PAST_CAP = 5;
    private static final Pageable BATCH = PageRequest.of(0, BATCH_SIZE, Sort.by("nextAttemptAt"));

    @Mock private MachineDeliveryRepository repository;
    @Mock private MachineOnlineStatus machineOnlineStatus;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryFailureRecorder failureRecorder;
    @Mock private DeliveryTracker tracker;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliverySpec<TestSeed, TestPayload> spec;

    @Captor private ArgumentCaptor<TestPayload> payloadCaptor;
    @Captor private ArgumentCaptor<Instant> nextAttemptCaptor;

    private DeliverySweepService service;

    private DeliveryProperties properties;
    private MachineDelivery delivery;
    private Instant dispatchedAt;

    @BeforeEach
    void setUp() {
        dispatchedAt = Instant.now().minusSeconds(ACK_THRESHOLD * 2);
        delivery = row(MACHINE_ID, PAYLOAD_JSON);
        properties = DeliveryTestPolicies.properties();
        service = new DeliverySweepService(repository, machineOnlineStatus, registry, properties,
                failureRecorder, tracker, metrics, new ObjectMapper());
    }

    @Test
    void retryPending_onlineWithAttemptsLeft_claimedThenRepublishedWithBackoff() {
        // setup
        Instant before = Instant.now();
        stubDue(delivery);
        stubMachine(DeviceStatus.ONLINE);
        stubSpec();
        when(spec.getPayloadClass()).thenReturn(TestPayload.class);
        when(repository.markRepublished(eq(delivery.getId()), any(Instant.class), nextAttemptCaptor.capture())).thenReturn(true);

        // execution
        service.retryPending();

        // verifications
        verify(spec).publish(eq(MACHINE_ID), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue().getValue()).isEqualTo(TARGET_ID);
        assertThat(nextAttemptCaptor.getValue())
                .isAfterOrEqualTo(before.plusSeconds(FIRST_RETRY_DELAY))
                .isBefore(before.plusSeconds(FIRST_RETRY_DELAY + CLOCK_SLACK_SECONDS));
        verify(metrics).recordRetried(DeliveryType.TOOL_INSTALLATION);
        verifyNoInteractions(failureRecorder, tracker);
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
        when(spec.getPayloadClass()).thenReturn(TestPayload.class);
        when(repository.markRepublished(eq(delivery.getId()), any(Instant.class), nextAttemptCaptor.capture())).thenReturn(true);

        // execution
        service.retryPending();

        // verifications
        assertThat(nextAttemptCaptor.getValue())
                .isAfterOrEqualTo(before.plusSeconds(MAX_RETRY_INTERVAL))
                .isBefore(before.plusSeconds(MAX_RETRY_INTERVAL + CLOCK_SLACK_SECONDS));
    }

    @Test
    void retryPending_ackedBetweenQueryAndClaim_notPublished() {
        // setup
        stubDue(delivery);
        stubMachine(DeviceStatus.ONLINE);
        stubSpec();
        when(repository.markRepublished(eq(delivery.getId()), any(Instant.class), any(Instant.class))).thenReturn(false);

        // execution
        service.retryPending();

        // verifications
        verify(spec, never()).publish(eq(MACHINE_ID), any(TestPayload.class));
        verifyNoInteractions(metrics, failureRecorder, tracker);
    }

    @Test
    void retryPending_onlineAttemptsExhausted_failedExhausted() {
        // setup
        delivery.setAttempts(MAX_ATTEMPTS);
        stubDue(delivery);
        stubMachine(DeviceStatus.ONLINE);
        stubSpec();

        // execution
        service.retryPending();

        // verifications
        verify(failureRecorder).fail(eq(delivery), eq(DeliveryFailure.EXHAUSTED), any(Instant.class));
        verify(repository, never()).markRepublished(eq(delivery.getId()), any(Instant.class), any(Instant.class));
        verifyNoInteractions(metrics);
    }

    @Test
    void retryPending_offlineInsideReconnectWindow_parkedUntilWindowEnd() {
        // setup
        stubDue(delivery);
        stubMachine(DeviceStatus.OFFLINE);
        stubSpec();

        // execution
        service.retryPending();

        // verifications
        verify(repository).postpone(delivery.getId(), dispatchedAt.plusSeconds(RECONNECT_WINDOW));
        verify(spec, never()).publish(eq(MACHINE_ID), any(TestPayload.class));
        verifyNoInteractions(failureRecorder, metrics);
    }

    @Test
    void retryPending_offlineReconnectWindowOver_failedOffline() {
        // setup
        Instant twoDaysAgo = Instant.now().minusSeconds(TWO_DAYS_SECONDS);
        delivery.setDispatchedAt(twoDaysAgo);
        stubDue(delivery);
        stubMachine(DeviceStatus.OFFLINE);
        stubSpec();

        // execution
        service.retryPending();

        // verifications
        verify(failureRecorder).fail(eq(delivery), eq(DeliveryFailure.OFFLINE), any(Instant.class));
        verify(repository, never()).postpone(eq(delivery.getId()), any(Instant.class));
    }

    @Test
    void retryPending_offlineWithRowSkipOverride_failedOfflineImmediately() {
        // setup
        delivery.setOfflineBehavior(ScheduleOfflineBehavior.SKIP);
        stubDue(delivery);
        stubMachine(DeviceStatus.OFFLINE);
        stubSpec();

        // execution
        service.retryPending();

        // verifications
        verify(failureRecorder).fail(eq(delivery), eq(DeliveryFailure.OFFLINE), any(Instant.class));
    }

    @Test
    void retryPending_machineDeleted_cancelled() {
        // setup
        stubDue(delivery);
        stubMachine(DeviceStatus.DELETED);

        // execution
        service.retryPending();

        // verifications
        verify(tracker).cancel(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);
        verifyNoInteractions(spec, failureRecorder, metrics);
    }

    @Test
    void retryPending_machineDocumentMissing_cancelled() {
        // setup
        stubDue(delivery);
        when(machineOnlineStatus.lookup(Set.of(MACHINE_ID))).thenReturn(new Lookup(Map.of()));

        // execution
        service.retryPending();

        // verifications
        verify(tracker).cancel(DeliveryType.TOOL_INSTALLATION, TARGET_ID, MACHINE_ID);
        verifyNoInteractions(spec, failureRecorder, metrics);
    }

    @Test
    void retryPending_oneRowCorrupt_otherRowStillRepublished() {
        // setup
        MachineDelivery corrupt = row(OTHER_MACHINE_ID, CORRUPT_JSON);
        stubDue(corrupt, delivery);
        Set<String> both = Set.of(OTHER_MACHINE_ID, MACHINE_ID);
        Map<String, DeviceStatus> bothOnline = Map.of(OTHER_MACHINE_ID, DeviceStatus.ONLINE, MACHINE_ID, DeviceStatus.ONLINE);
        when(machineOnlineStatus.lookup(both)).thenReturn(new Lookup(bothOnline));
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
        when(spec.getPayloadClass()).thenReturn(TestPayload.class);
        when(repository.markRepublished(eq(corrupt.getId()), any(Instant.class), any(Instant.class))).thenReturn(true);
        when(repository.markRepublished(eq(delivery.getId()), any(Instant.class), any(Instant.class))).thenReturn(true);

        // execution
        service.retryPending();

        // verifications
        verify(spec).publish(eq(MACHINE_ID), payloadCaptor.capture());
        assertThat(payloadCaptor.getValue().getValue()).isEqualTo(TARGET_ID);
        verify(spec, never()).publish(eq(OTHER_MACHINE_ID), any(TestPayload.class));
        verify(metrics).recordRetried(DeliveryType.TOOL_INSTALLATION);
    }

    @Test
    void retryPending_nothingDue_machinesNotLookedUp() {
        // setup
        stubDue();

        // execution
        service.retryPending();

        // verifications
        verifyNoInteractions(machineOnlineStatus, failureRecorder, tracker, metrics);
    }

    private MachineDelivery row(String machineId, String payloadJson) {
        return MachineDelivery.builder()
                .id(DeliveryId.of(DeliveryType.TOOL_INSTALLATION, TARGET_ID, machineId))
                .type(DeliveryType.TOOL_INSTALLATION)
                .targetId(TARGET_ID)
                .machineId(machineId)
                .status(DeliveryStatus.PENDING)
                .attempts(0)
                .payloadJson(payloadJson)
                .dispatchedAt(dispatchedAt)
                .lastAttemptAt(dispatchedAt)
                .nextAttemptAt(dispatchedAt.plusSeconds(ACK_THRESHOLD))
                .build();
    }

    private void stubDue(MachineDelivery... rows) {
        when(registry.types()).thenReturn(Set.of(DeliveryType.TOOL_INSTALLATION));
        when(repository.findByTypeAndStatusAndNextAttemptAtBefore(
                eq(DeliveryType.TOOL_INSTALLATION), eq(DeliveryStatus.PENDING), any(Instant.class), eq(BATCH)))
                .thenReturn(List.of(rows));
    }

    private void stubMachine(DeviceStatus status) {
        Lookup lookup = new Lookup(Map.of(MACHINE_ID, status));
        when(machineOnlineStatus.lookup(Set.of(MACHINE_ID))).thenReturn(lookup);
    }

    private void stubSpec() {
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
    }
}
