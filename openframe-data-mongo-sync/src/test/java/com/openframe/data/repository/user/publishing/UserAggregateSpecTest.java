package com.openframe.data.repository.user.publishing;

import com.openframe.data.document.user.User;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class UserAggregateSpecTest {

    private final UserOnTicketsProjection userOnTickets = mock(UserOnTicketsProjection.class);
    private final UserAggregateSpec spec = new UserAggregateSpec(userOnTickets);

    @Test
    void theEvent_carriesTheIdAndTheNamesOnly() {
        User user = User.builder().id("user-1").tenantId("tenant-a").email("ada@example.com").firstName("Ada")
                .lastName("Lovelace").build();

        UserEvent event = spec.toEvent(user);

        assertThat(event.getUserId()).isEqualTo("user-1");
        assertThat(event.getFirstName()).isEqualTo("Ada");
        assertThat(event.getLastName()).isEqualTo("Lovelace");
    }

    @Test
    void theSpec_isTheUsersType_withTheTicketProjection() {
        assertThat(spec.getType()).isEqualTo("users");
        assertThat(spec.projections()).containsExactly(userOnTickets);
    }
}
