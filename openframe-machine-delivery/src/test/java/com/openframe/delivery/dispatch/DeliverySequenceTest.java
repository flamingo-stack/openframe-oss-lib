package com.openframe.delivery.dispatch;

import com.openframe.data.document.delivery.MachineDeliverySequence;
import com.openframe.data.repository.delivery.MachineDeliverySequenceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliverySequenceTest {

    private static final String ROW_ID = "CLIENT_UPDATE:openframe-client:mach-42";
    private static final String MACHINE_ID = "mach-42";

    @Mock private MachineDeliverySequenceRepository repository;

    @Captor private ArgumentCaptor<MachineDeliverySequence> counterCaptor;

    @InjectMocks private DeliverySequence sequence;

    @Test
    void next_firstDispatchOfTheKey_counterCreatedAtOne() {
        // setup
        when(repository.findById(ROW_ID)).thenReturn(Optional.empty());

        // execution
        int next = sequence.next(ROW_ID, MACHINE_ID);

        // verifications
        assertThat(next).isEqualTo(1);
        verify(repository).save(counterCaptor.capture());
        MachineDeliverySequence created = counterCaptor.getValue();
        assertThat(created.getId()).isEqualTo(ROW_ID);
        assertThat(created.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(created.getValue()).isEqualTo(1);
    }

    @Test
    void next_existingCounter_incrementedAndSaved() {
        // setup
        MachineDeliverySequence existing = new MachineDeliverySequence();
        existing.setId(ROW_ID);
        existing.setValue(6);
        when(repository.findById(ROW_ID)).thenReturn(Optional.of(existing));

        // execution
        int next = sequence.next(ROW_ID, MACHINE_ID);

        // verifications
        assertThat(next).isEqualTo(7);
        verify(repository).save(existing);
        assertThat(existing.getValue()).isEqualTo(7);
    }

    @Test
    void next_concurrentFirstInsert_reportedAsOptimisticConflictSoTheRetryRunsAgain() {
        // setup
        when(repository.findById(ROW_ID)).thenReturn(Optional.empty());
        when(repository.save(any(MachineDeliverySequence.class))).thenThrow(new DuplicateKeyException("E11000"));

        // execution + verifications
        assertThatThrownBy(() -> sequence.next(ROW_ID, MACHINE_ID))
                .isInstanceOf(OptimisticLockingFailureException.class)
                .hasCauseInstanceOf(DuplicateKeyException.class);
    }
}
