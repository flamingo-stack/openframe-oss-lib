package com.openframe.data.repository.user.publishing;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UserEventTest {

    @Test
    void theFullName_isTheTrimmedFirstAndLastName() {
        assertThat(UserEvent.fullName(" Ada ", "Lovelace ")).isEqualTo("Ada Lovelace");
    }

    @Test
    void aMissingOrBlankPart_isLeftOut() {
        assertThat(UserEvent.fullName("Ada", null)).isEqualTo("Ada");
        assertThat(UserEvent.fullName("  ", "Lovelace")).isEqualTo("Lovelace");
        assertThat(UserEvent.fullName(null, null)).isEmpty();
    }
}
