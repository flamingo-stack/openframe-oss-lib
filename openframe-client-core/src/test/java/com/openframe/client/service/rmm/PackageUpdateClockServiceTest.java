package com.openframe.client.service.rmm;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.delivery.PackageUpdateDeliverySeed;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageUpdateClockServiceTest {

    @Mock private DeliveryDispatcher deliveryDispatcher;
    @Mock private PackageUpdateDeviceStateRepository deviceStateRepository;
    @Mock private PackageUpdateRequestRepository requestRepository;

    @InjectMocks private PackageUpdateClockService service;

    @BeforeEach
    void config() {
        ReflectionTestUtils.setField(service, "deadlineBatchSize", 500);
        ReflectionTestUtils.setField(service, "retryBatchSize", 500);
        ReflectionTestUtils.setField(service, "maxAttempts", 3);
        ReflectionTestUtils.setField(service, "backoffSeconds", 21600L);
    }

    private PackageUpdateDeviceState device(String machineId, SoftwareActionStatus status) {
        return PackageUpdateDeviceState.builder()
                .tenantId("t1").requestId("req-1").machineId(machineId).status(status).build();
    }

    private PackageUpdateRequest request(PackageUpdateSource source, int attempts, Instant updatedAt) {
        return PackageUpdateRequest.builder()
                .tenantId("t1").requestId("req-1").source(source).mode(PackageUpdateMode.WAIT)
                .packageManager(PackageManagerType.WINGET).packageName("Google.Chrome")
                .forceCountdownSeconds(300).status(SoftwareActionStatus.FAILED)
                .attempts(attempts).updatedAt(updatedAt).build();
    }

    // --- deadline force ---

    @Test
    void forceExpiredDeadlines_sendsForce_andMarksForced() {
        PackageUpdateDeviceState state = device("m1", SoftwareActionStatus.WAITING);
        state.setDeadlineAt(Instant.now().minusSeconds(60));
        when(deviceStateRepository.findByStatusAndForcedFalseAndDeadlineAtBefore(
                eq(SoftwareActionStatus.WAITING), any(), any(Pageable.class))).thenReturn(List.of(state));
        when(requestRepository.findByTenantIdAndRequestId("t1", "req-1"))
                .thenReturn(Optional.of(request(PackageUpdateSource.AUTO, 1, Instant.now())));

        service.forceExpiredDeadlines();

        ArgumentCaptor<PackageUpdateDeliverySeed> seed = ArgumentCaptor.forClass(PackageUpdateDeliverySeed.class);
        verify(deliveryDispatcher).dispatch(seed.capture());
        assertThat(seed.getValue().getMode()).isEqualTo(PackageUpdateMode.FORCE);
        assertThat(seed.getValue().getCountdownSeconds()).isEqualTo(300);
        assertThat(seed.getValue().getMachineId()).isEqualTo("m1");

        assertThat(state.isForced()).isTrue();
        verify(deviceStateRepository).save(state);
    }

    @Test
    void forceExpiredDeadlines_noRequestRow_skips() {
        PackageUpdateDeviceState state = device("m1", SoftwareActionStatus.WAITING);
        state.setDeadlineAt(Instant.now().minusSeconds(60));
        when(deviceStateRepository.findByStatusAndForcedFalseAndDeadlineAtBefore(any(), any(), any(Pageable.class)))
                .thenReturn(List.of(state));
        when(requestRepository.findByTenantIdAndRequestId("t1", "req-1")).thenReturn(Optional.empty());

        service.forceExpiredDeadlines();

        verifyNoInteractions(deliveryDispatcher);
        verify(deviceStateRepository, never()).save(any());
    }

    // --- bounded AUTO retry ---

    @Test
    void retry_belowCap_backoffElapsed_resendsOnlyFailedDevices_andBumpsAttempts() {
        PackageUpdateRequest req = request(PackageUpdateSource.AUTO, 1, Instant.now().minusSeconds(25_000));
        when(requestRepository.findBySourceAndStatus(eq(PackageUpdateSource.AUTO),
                eq(SoftwareActionStatus.FAILED), any(Pageable.class))).thenReturn(List.of(req));
        PackageUpdateDeviceState m1 = device("m1", SoftwareActionStatus.FAILED);
        PackageUpdateDeviceState m2 = device("m2", SoftwareActionStatus.COMPLETED);
        when(deviceStateRepository.findByTenantIdAndRequestId("t1", "req-1")).thenReturn(List.of(m1, m2));

        service.retryFailedAutoUpdates();

        ArgumentCaptor<PackageUpdateDeliverySeed> seed = ArgumentCaptor.forClass(PackageUpdateDeliverySeed.class);
        verify(deliveryDispatcher).dispatch(seed.capture());          // only the failed device
        assertThat(seed.getValue().getMachineId()).isEqualTo("m1");
        assertThat(m1.getStatus()).isEqualTo(SoftwareActionStatus.SCHEDULED);
        assertThat(m1.getLastEventId()).isNull();
        verify(deviceStateRepository).save(m1);
        assertThat(req.getAttempts()).isEqualTo(2);
        assertThat(req.getStatus()).isEqualTo(SoftwareActionStatus.SCHEDULED);
        verify(requestRepository).save(req);
    }

    @Test
    void retry_attemptsExhausted_skips() {
        PackageUpdateRequest req = request(PackageUpdateSource.AUTO, 3, Instant.now().minusSeconds(25_000));
        when(requestRepository.findBySourceAndStatus(any(), any(), any(Pageable.class))).thenReturn(List.of(req));

        service.retryFailedAutoUpdates();

        verifyNoInteractions(deliveryDispatcher);
        verify(requestRepository, never()).save(any());
    }

    @Test
    void retry_withinBackoff_skips() {
        PackageUpdateRequest req = request(PackageUpdateSource.AUTO, 1, Instant.now());  // just updated
        when(requestRepository.findBySourceAndStatus(any(), any(), any(Pageable.class))).thenReturn(List.of(req));

        service.retryFailedAutoUpdates();

        verifyNoInteractions(deliveryDispatcher);
        verify(requestRepository, never()).save(any());
    }

    @Test
    void retry_onlySupersededDevices_notRetried() {
        PackageUpdateRequest req = request(PackageUpdateSource.AUTO, 1, Instant.now().minusSeconds(25_000));
        when(requestRepository.findBySourceAndStatus(any(), any(), any(Pageable.class))).thenReturn(List.of(req));
        PackageUpdateDeviceState superseded = device("m1", SoftwareActionStatus.FAILED);
        superseded.setFailedReason("SUPERSEDED");
        when(deviceStateRepository.findByTenantIdAndRequestId("t1", "req-1")).thenReturn(List.of(superseded));

        service.retryFailedAutoUpdates();

        verifyNoInteractions(deliveryDispatcher);
        verify(requestRepository, never()).save(any());
    }
}
