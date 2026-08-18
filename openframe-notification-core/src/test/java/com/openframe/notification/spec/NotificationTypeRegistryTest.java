package com.openframe.notification.spec;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.stream.Stream;

import org.springframework.beans.factory.ObjectProvider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NotificationTypeRegistryTest {

    @Test
    void resolves_registered_spec_by_type() {
        NotificationTypeSpec spec = spec("TICKET_ASSIGNED");

        NotificationTypeRegistry registry = new NotificationTypeRegistry(provider(spec));

        assertThat(registry.require("TICKET_ASSIGNED")).isSameAs(spec);
    }

    @Test
    @DisplayName("An unknown type is a producer bug and fails loudly at emission")
    void unknown_type_throws() {
        NotificationTypeRegistry registry = new NotificationTypeRegistry(provider());

        assertThatThrownBy(() -> registry.require("NOPE"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("NOPE");
    }

    @Test
    @DisplayName("Two specs claiming one type kill the context at startup, not a random one at runtime")
    void duplicate_type_fails_fast() {
        ObjectProvider<NotificationTypeSpec> duplicates = provider(spec("X"), spec("X"));
        assertThatThrownBy(() -> new NotificationTypeRegistry(duplicates))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("X");
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<NotificationTypeSpec> provider(NotificationTypeSpec... specs) {
        ObjectProvider<NotificationTypeSpec> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenReturn(Stream.of(specs));
        return provider;
    }

    private static NotificationTypeSpec spec(String type) {
        NotificationTypeSpec spec = mock(NotificationTypeSpec.class);
        when(spec.getType()).thenReturn(type);
        return spec;
    }
}
