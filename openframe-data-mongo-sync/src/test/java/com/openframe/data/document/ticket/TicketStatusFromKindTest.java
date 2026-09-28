package com.openframe.data.document.ticket;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Apps built before the lifecycle rollout — the mobile and desktop shells carry a frozen web
 * bundle — still ask for the legacy status. The field is no longer stored, so it is derived from
 * the lifecycle kind on the way out. Every kind has to map to something: a null would reach those
 * clients as a missing status and break the board they render from it.
 */
class TicketStatusFromKindTest {

    @ParameterizedTest
    @CsvSource({
            "AI_ASSISTANCE, ACTIVE",
            "TECH_REQUIRED, TECH_REQUIRED",
            "RESOLVED, RESOLVED",
            "ARCHIVED, ARCHIVED",
    })
    void systemKindsMapToTheirHistoricalEquivalent(TicketStatusKind kind, TicketStatus expected) {
        assertThat(TicketStatus.fromKind(kind)).isEqualTo(expected);
    }

    /**
     * A custom column has no legacy equivalent — the enum predates them. It reports as
     * TECH_REQUIRED: the ticket left the assistant and a human owns it, which is what the legacy
     * clients used that value for.
     */
    @Test
    void aCustomColumnReportsAsTechRequired() {
        assertThat(TicketStatus.fromKind(TicketStatusKind.CUSTOM)).isEqualTo(TicketStatus.TECH_REQUIRED);
    }

    @Test
    void anUnknownKindStillYieldsAStatus() {
        assertThat(TicketStatus.fromKind(null)).isEqualTo(TicketStatus.ACTIVE);
    }

    @ParameterizedTest
    @EnumSource(TicketStatusKind.class)
    void everyKindIsMapped(TicketStatusKind kind) {
        assertThat(TicketStatus.fromKind(kind)).isNotNull();
    }
}
