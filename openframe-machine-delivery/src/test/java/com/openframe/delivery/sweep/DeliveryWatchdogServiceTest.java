package com.openframe.delivery.sweep;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.config.DeliveryTestPolicies;
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
    private static final Pageable BATCH = PageRequest.of(0, BATCH_SIZE, Sort.by("dueAt"));

    @Mock private MachineDeliveryRepository repository;
    @Mock private DeliveryFailureRecorder failureRecorder;

    private DeliveryWatchdogService service;

    private MachineDelivery silentDelivery;
    private MachineDelivery otherSilentDelivery;

    @BeforeEach
    void setUp() {
        silentDelivery = silentRow(FIRST_ID);
        otherSilentDelivery = silentRow(SECOND_ID);
        DeliveryProperties properties = DeliveryTestPolicies.properties();
        service = new DeliveryWatchdogService(repository, properties, failureRecorder);
    }

    @Test
    void reapAcked_ackedRowPastResultDeadline_failedTimeout() {
        // setup
        stubOverdue(silentDelivery);

        // execution
        service.reapAcked();

        // verifications
        verify(failureRecorder).record(eq(silentDelivery), eq(DeliveryFailure.TIMEOUT), any(Instant.class));
    }

    @Test
    void reapAcked_firstRowThrows_secondRowStillFailed() {
        // setup
        stubOverdue(silentDelivery, otherSilentDelivery);
        doThrow(new IllegalStateException("boom"))
                .when(failureRecorder).record(eq(silentDelivery), eq(DeliveryFailure.TIMEOUT), any(Instant.class));

        // execution
        service.reapAcked();

        // verifications
        verify(failureRecorder).record(eq(otherSilentDelivery), eq(DeliveryFailure.TIMEOUT), any(Instant.class));
    }

    @Test
    void reapAcked_nothingOverdue_noFailure() {
        // setup
        stubOverdue();

        // execution
        service.reapAcked();

        // verifications
        verifyNoInteractions(failureRecorder);
    }

    private void stubOverdue(MachineDelivery... rows) {
        when(repository.findByStatusAndDueAtBefore(eq(DeliveryStatus.ACKED), any(Instant.class), eq(BATCH)))
                .thenReturn(List.of(rows));
    }

    private static MachineDelivery silentRow(String id) {
        return MachineDelivery.builder()
                .id(id)
                .type(DeliveryType.CLIENT_UNINSTALL)
                .status(DeliveryStatus.ACKED)
                .build();
    }
}
