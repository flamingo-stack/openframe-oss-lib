package com.openframe.gateway.config.ws.nats;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class NatsClientIdentityTest {

    @Test
    void device_machineUuid_deviceIdentity() {
        // execution
        NatsClientIdentity identity = NatsClientIdentity.device("5bc73478-2240-4de2-a6ad-07d77e38b7dc");

        // verifications
        assertThat(identity.getKind()).isEqualTo(NatsClientKind.DEVICE);
        assertThat(identity.getId()).isEqualTo("5bc73478-2240-4de2-a6ad-07d77e38b7dc");
    }

    @Test
    void user_mongoId_userIdentity() {
        // execution
        NatsClientIdentity identity = NatsClientIdentity.user("6b037246a04f7e706ef513cb");

        // verifications
        assertThat(identity.getKind()).isEqualTo(NatsClientKind.USER);
        assertThat(identity.getId()).isEqualTo("6b037246a04f7e706ef513cb");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "*", ">", "m.1", "m 1", "m\t1", "user@example.com", "a*b", "a>"})
    void device_idThatIsNotOneLiteralToken_throws(String id) {
        // execution
        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> NatsClientIdentity.device(id));

        // verifications
        assertThat(exception.getMessage()).contains("machine id");
    }

    @ParameterizedTest
    @ValueSource(strings = {"*", "u.1", "user@example.com"})
    void user_idThatIsNotOneLiteralToken_throws(String id) {
        // execution
        IllegalStateException exception = assertThrows(IllegalStateException.class, () -> NatsClientIdentity.user(id));

        // verifications
        assertThat(exception.getMessage()).contains("user id");
    }
}
