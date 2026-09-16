package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static com.openframe.delivery.DeliveryTestPolicies.RESULT_TIMEOUT;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryWatchdogServiceTest {

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryFailureRecorder failureRecorder;

    private DeliveryWatchdogService service;

    private MachineDelivery silentDelivery;

    @BeforeEach
    void setUp() {
        silentDelivery = MachineDelivery.builder()
                .type(DeliveryType.CLIENT_UNINSTALL)
                .status(DeliveryStatus.ACKED)
                .ackedAt(Instant.now().minusSeconds(RESULT_TIMEOUT * 2))
                .build();
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        service = new DeliveryWatchdogService(repository, registry, properties, failureRecorder);
    }

    @Test
    void reapAcked_ackedOlderThanResultTimeout_failedTimeout() {
        // setup
        when(registry.types()).thenReturn(Set.of(DeliveryType.CLIENT_UNINSTALL));
        when(repository.findByTypeAndStatusAndAckedAtBefore(eq(DeliveryType.CLIENT_UNINSTALL), eq(DeliveryStatus.ACKED), any(Instant.class)))
                .thenReturn(List.of(silentDelivery));

        // execution
        service.reapAcked();

        // verifications
        verify(failureRecorder).fail(eq(silentDelivery), eq(DeliveryFailure.TIMEOUT), any(Instant.class));
    }

    @Test
    void reapAcked_nothingSilent_noFailure() {
        // setup
        when(registry.types()).thenReturn(Set.of(DeliveryType.CLIENT_UNINSTALL));
        when(repository.findByTypeAndStatusAndAckedAtBefore(eq(DeliveryType.CLIENT_UNINSTALL), eq(DeliveryStatus.ACKED), any(Instant.class)))
                .thenReturn(List.of());

        // execution
        service.reapAcked();

        // verifications
        verifyNoInteractions(failureRecorder);
    }
}
