package com.openframe.delivery.sweep;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.track.DeliveryCloser;
import com.openframe.delivery.config.DeliveryTestPolicies;
import com.openframe.delivery.metrics.DeliveryMetrics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static com.openframe.delivery.config.DeliveryTestPolicies.BATCH_SIZE;
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

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliveryCloser closer;
    @Mock private DeliveryMetrics metrics;

    private DeliveryWatchdogService service;

    private MachineDelivery silentDelivery;
    private MachineDelivery otherSilentDelivery;
    private Instant dispatchedAt;

    @BeforeEach
    void setUp() {
        dispatchedAt = Instant.now().minusSeconds(900);
        silentDelivery = silentRow(FIRST_ID);
        otherSilentDelivery = silentRow(SECOND_ID);
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        service = new DeliveryWatchdogService(repository, properties, closer, metrics);
    }

    @Test
    void reapAcked_ackedRowPastResultDeadline_failedTimeoutOnlyIfStillAcked() {
        // setup
        stubOverdue(silentDelivery);

        // execution
        service.reapAcked();

        // verifications
        verify(closer).fail(eq(silentDelivery), eq(DeliveryFailure.TIMEOUT), eq(DeliveryStatus.AWAITING_RESULT), any(Instant.class));
        verifyNoInteractions(metrics);
    }

    @Test
    void reapAcked_firstRowThrows_firstPostponedSecondStillFailed() {
        // setup
        stubOverdue(silentDelivery, otherSilentDelivery);
        doThrow(new IllegalStateException("boom"))
                .when(closer).fail(eq(silentDelivery), eq(DeliveryFailure.TIMEOUT), eq(DeliveryStatus.AWAITING_RESULT), any(Instant.class));

        // execution
        service.reapAcked();

        // verifications
        verify(repository).postpone(eq(FIRST_ID), eq(DeliveryStatus.AWAITING_RESULT), eq(dispatchedAt), any(Instant.class));
        verify(closer).fail(eq(otherSilentDelivery), eq(DeliveryFailure.TIMEOUT), eq(DeliveryStatus.AWAITING_RESULT), any(Instant.class));
        verify(metrics).recordRowError();
    }

    @Test
    void reapAcked_nothingOverdue_noFailure() {
        // setup
        stubOverdue();

        // execution
        service.reapAcked();

        // verifications
        verifyNoInteractions(closer, metrics);
    }

    private void stubOverdue(MachineDelivery... rows) {
        when(repository.findDue(eq(DeliveryStatus.ACKED), any(Instant.class), eq(BATCH_SIZE))).thenReturn(List.of(rows));
    }

    private MachineDelivery silentRow(String id) {
        return MachineDelivery.builder()
                .id(id)
                .type(DeliveryType.CLIENT_UNINSTALL)
                .status(DeliveryStatus.ACKED)
                .dispatchedAt(dispatchedAt)
                .build();
    }
}
