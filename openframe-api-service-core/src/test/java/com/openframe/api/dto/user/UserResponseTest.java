package com.openframe.api.dto.user;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UserResponseTest {

    @Test
    @DisplayName("system(): synthetic initiator for system-triggered executions — id + firstName = SYSTEM, empty lastName")
    void system_isSystemUser() {
        UserResponse system = UserResponse.system();

        assertThat(system.getId()).isEqualTo(UserResponse.SYSTEM_ID);
        assertThat(system.getId()).isEqualTo("SYSTEM");
        assertThat(system.getFirstName()).isEqualTo("SYSTEM");
        assertThat(system.getLastName()).isEmpty();
    }
}
