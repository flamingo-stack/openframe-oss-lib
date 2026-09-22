package com.openframe.management.migration;

import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.seed.ticket.TicketStatusSeedCatalog;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The unit runs on every boot, so it has to be safe to repeat: a tenant that already has its board
 * must come out unchanged. Above all the admin-owned "On Hold" column is seeded by name — renaming
 * or deleting it is the admin's decision, and the next boot must not undo it.
 */
@ExtendWith(MockitoExtension.class)
class MigrateTicketStatusesChangeUnitTest {

    @Mock private MongoTemplate mongoTemplate;

    @InjectMocks private MigrateTicketStatusesChangeUnit changeUnit;

    @Test
    void seedsTheFourSystemStatusesAndTheOnHoldColumn() {
        givenOnHoldMissing();

        changeUnit.execution(mongoTemplate);

        assertThat(savedStatuses())
                .extracting(TicketStatusDefinition::getKind)
                .containsExactly(
                        TicketStatusKind.AI_ASSISTANCE,
                        TicketStatusKind.TECH_REQUIRED,
                        TicketStatusKind.RESOLVED,
                        TicketStatusKind.ARCHIVED,
                        TicketStatusKind.CUSTOM);
    }

    @Test
    void theSeededOnHoldColumnIsACustomOneNamedOnHold() {
        givenOnHoldMissing();

        changeUnit.execution(mongoTemplate);

        assertThat(savedStatuses()).last().satisfies(onHold -> {
            assertThat(onHold.getKind()).isEqualTo(TicketStatusKind.CUSTOM);
            assertThat(onHold.getName()).isEqualTo(TicketStatusSeedCatalog.NAME_ON_HOLD);
            assertThat(onHold.getPosition()).isNotBlank();
        });
    }

    /** The admin renamed or deleted it — a re-run must leave that alone. */
    @Test
    void anExistingOnHoldColumnIsNotSeededAgain() {
        givenOnHoldPresent();

        changeUnit.execution(mongoTemplate);

        assertThat(savedStatuses())
                .extracting(TicketStatusDefinition::getKind)
                .doesNotContain(TicketStatusKind.CUSTOM);
    }

    @Test
    void statusesThatAlreadyExistAreSkippedWithoutFailingTheBoot() {
        givenOnHoldMissing();
        when(mongoTemplate.save(any(TicketStatusDefinition.class)))
                .thenThrow(new DuplicateKeyException("status already seeded"));

        assertThatCode(() -> changeUnit.execution(mongoTemplate)).doesNotThrowAnyException();
    }

    @Test
    void ticketsAreLeftUntouched() {
        givenOnHoldMissing();

        changeUnit.execution(mongoTemplate);

        verify(mongoTemplate, never()).updateFirst(any(), any(), eq("tickets"));
        verify(mongoTemplate, never()).find(any(), any(), eq("tickets"));
    }

    @Test
    void rollbackIsANoOp() {
        assertThatCode(() -> changeUnit.rollback()).doesNotThrowAnyException();
    }

    private void givenOnHoldMissing() {
        when(mongoTemplate.exists(any(Query.class), eq(TicketStatusDefinition.class))).thenReturn(false);
    }

    private void givenOnHoldPresent() {
        when(mongoTemplate.exists(any(Query.class), eq(TicketStatusDefinition.class))).thenReturn(true);
    }

    private List<TicketStatusDefinition> savedStatuses() {
        ArgumentCaptor<TicketStatusDefinition> captor = ArgumentCaptor.forClass(TicketStatusDefinition.class);
        verify(mongoTemplate, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        return captor.getAllValues();
    }
}
