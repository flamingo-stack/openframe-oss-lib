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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static com.openframe.delivery.DeliveryTestPolicies.BATCH_SIZE;
import static com.openframe.delivery.DeliveryTestPolicies.RESULT_TIMEOUT;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryWatchdogServiceTest {

    private static final String FIRST_ID = "CLIENT_UNINSTALL:openframe-client:mach-1";
    private static final String SECOND_ID = "CLIENT_UNINSTALL:openframe-client:mach-2";
    private static final Pageable BATCH = PageRequest.of(0, BATCH_SIZE, Sort.by("ackedAt"));

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliverySpecRegistry registry;
    @Mock private DeliveryFailureRecorder failureRecorder;

    private DeliveryWatchdogService service;

    private MachineDelivery silentDelivery;
    private MachineDelivery otherSilentDelivery;

    @BeforeEach
    void setUp() {
        silentDelivery = silentRow(FIRST_ID);
        otherSilentDelivery = silentRow(SECOND_ID);
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        service = new DeliveryWatchdogService(repository, registry, properties, failureRecorder);
    }

    @Test
    void reapAcked_ackedOlderThanResultTimeout_failedTimeout() {
        // setup
        stubSilent(silentDelivery);

        // execution
        service.reapAcked();

        // verifications
        verify(failureRecorder).fail(eq(silentDelivery), eq(DeliveryFailure.TIMEOUT), any(Instant.class));
    }

    @Test
    void reapAcked_firstRowThrows_secondRowStillFailed() {
        // setup
        stubSilent(silentDelivery, otherSilentDelivery);
        doThrow(new IllegalStateException("boom"))
                .when(failureRecorder).fail(eq(silentDelivery), eq(DeliveryFailure.TIMEOUT), any(Instant.class));

        // execution
        service.reapAcked();

        // verifications
        verify(failureRecorder).fail(eq(otherSilentDelivery), eq(DeliveryFailure.TIMEOUT), any(Instant.class));
    }

    @Test
    void reapAcked_nothingSilent_noFailure() {
        // setup
        stubSilent();

        // execution
        service.reapAcked();

        // verifications
        verifyNoInteractions(failureRecorder);
    }

    private void stubSilent(MachineDelivery... rows) {
        when(registry.types()).thenReturn(Set.of(DeliveryType.CLIENT_UNINSTALL));
        when(repository.findByTypeAndStatusAndAckedAtBefore(
                eq(DeliveryType.CLIENT_UNINSTALL), eq(DeliveryStatus.ACKED), any(Instant.class), eq(BATCH)))
                .thenReturn(List.of(rows));
    }

    private static MachineDelivery silentRow(String id) {
        return MachineDelivery.builder()
                .id(id)
                .type(DeliveryType.CLIENT_UNINSTALL)
                .status(DeliveryStatus.ACKED)
                .ackedAt(Instant.now().minusSeconds(RESULT_TIMEOUT * 2))
                .build();
    }
}
