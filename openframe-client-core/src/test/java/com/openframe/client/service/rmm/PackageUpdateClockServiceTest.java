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
}
