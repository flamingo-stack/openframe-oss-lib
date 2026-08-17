package com.openframe.notification.spec;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NotificationTypeRegistryTest {

    @Test
    void resolves_registered_spec_by_type() {
        NotificationTypeSpec spec = spec("TICKET_ASSIGNED");

        NotificationTypeRegistry registry = new NotificationTypeRegistry(List.of(spec));

        assertThat(registry.require("TICKET_ASSIGNED")).isSameAs(spec);
    }

    @Test
    @DisplayName("An unknown type is a producer bug and fails loudly at emission")
    void unknown_type_throws() {
        NotificationTypeRegistry registry = new NotificationTypeRegistry(List.of());

        assertThatThrownBy(() -> registry.require("NOPE"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("NOPE");
    }

    @Test
    @DisplayName("Two specs claiming one type kill the context at startup, not a random one at runtime")
    void duplicate_type_fails_fast() {
        assertThatThrownBy(() -> new NotificationTypeRegistry(List.of(spec("X"), spec("X"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("X");
    }

    private static NotificationTypeSpec spec(String type) {
        NotificationTypeSpec spec = mock(NotificationTypeSpec.class);
        when(spec.type()).thenReturn(type);
        return spec;
    }
}
