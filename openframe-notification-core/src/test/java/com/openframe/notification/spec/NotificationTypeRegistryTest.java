package com.openframe.notification.spec;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NotificationTypeRegistryTest {

    private enum TestType implements NotificationType { TICKET_ASSIGNED, UNREGISTERED }

    @Test
    void resolves_registered_spec_by_type() {
        NotificationTypeSpec spec = spec(TestType.TICKET_ASSIGNED);

        NotificationTypeRegistry registry = new NotificationTypeRegistry(provider(spec));

        assertThat(registry.require(TestType.TICKET_ASSIGNED)).isSameAs(spec);
    }

    @Test
    @DisplayName("A type without a registered spec is a producer bug and fails loudly at emission")
    void unregistered_type_throws() {
        NotificationTypeRegistry registry = new NotificationTypeRegistry(provider());

        assertThatThrownBy(() -> registry.require(TestType.UNREGISTERED))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("UNREGISTERED");
    }

    @Test
    @DisplayName("Two specs claiming one type kill the context at startup, not a random one at runtime")
    void duplicate_type_fails_fast() {
        ObjectProvider<NotificationTypeSpec> duplicates =
                provider(spec(TestType.TICKET_ASSIGNED), spec(TestType.TICKET_ASSIGNED));

        assertThatThrownBy(() -> new NotificationTypeRegistry(duplicates))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("TICKET_ASSIGNED");
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<NotificationTypeSpec> provider(NotificationTypeSpec... specs) {
        ObjectProvider<NotificationTypeSpec> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenReturn(Stream.of(specs));
        return provider;
    }

    private static NotificationTypeSpec spec(NotificationType type) {
        NotificationTypeSpec spec = mock(NotificationTypeSpec.class);
        when(spec.getType()).thenReturn(type);
        return spec;
    }
}
