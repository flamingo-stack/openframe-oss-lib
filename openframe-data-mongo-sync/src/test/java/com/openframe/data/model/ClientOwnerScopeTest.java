package com.openframe.data.model;

import com.openframe.data.document.ticket.AdminTicketOwner;
import com.openframe.data.document.ticket.ClientTicketOwner;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ClientOwnerScopeTest {

    private static final ClientOwnerScope UNDER_ORG_B = new ClientOwnerScope("machine-1", "org-b", null);

    @ParameterizedTest(name = "owner machine={0} org={1} -> visible={2}")
    @CsvSource(nullValues = "null", value = {
            "machine-1, org-b, true",
            "machine-1, org-a, false",
            "machine-1, null, true",
            "machine-2, org-b, false",
            "null, org-b, false"
    })
    void allows_machineUnderOrganization_onlyItsOwnItemsCreatedUnderThatOrganization(
            String ownerMachineId, String ownerOrganizationId, boolean expected) {
        assertThat(UNDER_ORG_B.allows(ownerMachineId, ownerOrganizationId, null)).isEqualTo(expected);
    }

    @Test
    void allows_machineOrganizationUnknown_everyOwnItemVisible() {
        ClientOwnerScope scope = new ClientOwnerScope("machine-1", null, null);

        assertThat(scope.allows("machine-1", "org-a", null)).isTrue();
        assertThat(scope.allows("machine-2", "org-a", null)).isFalse();
    }

    @Test
    void allows_itemFromBeforeTheCurrentEnrollment_hidden() {
        Instant assignedAt = Instant.parse("2026-10-20T10:00:00Z");
        ClientOwnerScope scope = new ClientOwnerScope("machine-1", "org-b", assignedAt);

        assertThat(scope.allows("machine-1", "org-b", assignedAt.minusSeconds(1))).isFalse();
        assertThat(scope.allows("machine-1", "org-b", assignedAt)).isTrue();
        assertThat(scope.allows("machine-1", "org-b", null)).isFalse();
        assertThat(UNDER_ORG_B.allows("machine-1", "org-b", assignedAt.minusSeconds(1))).isTrue();
    }

    @Test
    void allows_ticketOwner_clientOwnerJudgedAdminOwnerDenied() {
        assertThat(UNDER_ORG_B.allows(new ClientTicketOwner("machine-1", "org-b"), null)).isTrue();
        assertThat(UNDER_ORG_B.allows(new ClientTicketOwner("machine-1", "org-a"), null)).isFalse();
        assertThat(UNDER_ORG_B.allows(new AdminTicketOwner("user-1"), null)).isFalse();
        assertThat(UNDER_ORG_B.allows(null, null)).isFalse();
    }
}
