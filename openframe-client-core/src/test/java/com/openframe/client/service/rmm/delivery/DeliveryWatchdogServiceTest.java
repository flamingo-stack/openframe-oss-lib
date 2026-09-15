package com.openframe.client.service.rmm.delivery;

import com.openframe.client.service.rmm.delivery.DeliveryProperties.Policy;
import com.openframe.data.document.rmm.delivery.DeliveryFailure;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.DeliveryStatus;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.repository.rmm.MachineDeliveryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryWatchdogServiceTest {

    private static final long RESULT_TIMEOUT = 600L;

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryFailureRecorder failureRecorder;

    private DeliveryWatchdogService service;

    private MachineDelivery silentDelivery;

    @BeforeEach
    void setUp() {
        Policy defaults = new Policy();
        defaults.setAckThresholdSeconds(30L);
        defaults.setMaxAttempts(3);
        defaults.setOfflineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        defaults.setReconnectWindowSeconds(86_400L);
        defaults.setResultTimeoutSeconds(RESULT_TIMEOUT);
        defaults.setTtlSeconds(604_800L);
        DeliveryProperties properties = new DeliveryProperties();
        properties.setDefaults(defaults);

        silentDelivery = MachineDelivery.builder()
                .kind(DeliveryKind.CLIENT_UNINSTALL)
                .status(DeliveryStatus.ACKED)
                .ackedAt(Instant.now().minusSeconds(RESULT_TIMEOUT * 2))
                .build();

        service = new DeliveryWatchdogService(repository, registry, properties, failureRecorder);
    }

    @Test
    void reapAcked_ackedOlderThanResultTimeout_failedTimeout() {
        // setup
        when(registry.kinds()).thenReturn(Set.of(DeliveryKind.CLIENT_UNINSTALL));
        when(repository.findByKindAndStatusAndAckedAtBefore(eq(DeliveryKind.CLIENT_UNINSTALL), eq(DeliveryStatus.ACKED), any(Instant.class)))
                .thenReturn(List.of(silentDelivery));

        // execution
        service.reapAcked();

        // verifications
        verify(failureRecorder).fail(eq(silentDelivery), eq(DeliveryFailure.TIMEOUT), any(Instant.class));
    }

    @Test
    void reapAcked_nothingSilent_noFailure() {
        // setup
        when(registry.kinds()).thenReturn(Set.of(DeliveryKind.CLIENT_UNINSTALL));
        when(repository.findByKindAndStatusAndAckedAtBefore(eq(DeliveryKind.CLIENT_UNINSTALL), eq(DeliveryStatus.ACKED), any(Instant.class)))
                .thenReturn(List.of());

        // execution
        service.reapAcked();

        // verifications
        verifyNoInteractions(failureRecorder);
    }
}
