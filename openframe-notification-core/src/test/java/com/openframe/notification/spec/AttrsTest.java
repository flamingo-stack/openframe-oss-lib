package com.openframe.notification.spec;

import com.fasterxml.jackson.core.type.TypeReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AttrsTest {

    private static final AttrKey TICKET_ID = AttrKey.of("ticketId");
    private static final AttrKey ACTOR_ID = AttrKey.of("actorId");
    private static final AttrKey TOOL_CALLS = AttrKey.of("toolCalls");

    private enum TestType implements NotificationType { TEST_TYPE }

    @Test
    @DisplayName("Given all required keys present, when validated, then values are readable")
    void valid_attrs_pass() {
        Attrs attrs = Attrs.validated(spec(Set.of(TICKET_ID)), Map.of("ticketId", "t-1"));

        assertThat(attrs.get(TICKET_ID)).isEqualTo("t-1");
        assertThat(attrs.has(TICKET_ID)).isTrue();
    }

    @Test
    @DisplayName("Given a missing or blank required key, when validated, then the producer's bug is named")
    void missing_or_blank_required_key_rejected() {
        assertThatThrownBy(() -> Attrs.validated(spec(Set.of(TICKET_ID)), Map.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ticketId");
        assertThatThrownBy(() -> Attrs.validated(spec(Set.of(TICKET_ID)), Map.of("ticketId", "  ")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ticketId");
    }

    @Test
    @DisplayName("Undeclared keys are dropped, not rejected — a producer may emit a fact before the catalog consumes it")
    void undeclared_key_dropped() {
        Attrs attrs = Attrs.validated(spec(Set.of(TICKET_ID)), Map.of("ticketId", "t-1", "futureFact", "x"));

        assertThat(attrs.asMap()).containsOnlyKeys("ticketId");
    }

    @Test
    @DisplayName("A declared optional key is kept when present and legal to omit")
    void optional_key_kept_or_omitted() {
        NotificationTypeSpec spec = spec(Set.of(TICKET_ID));
        when(spec.getOptionalKeys()).thenReturn(Set.of(ACTOR_ID));

        Attrs present = Attrs.validated(spec, Map.of("ticketId", "t-1", "actorId", "u-1"));
        Attrs absent = Attrs.validated(spec, Map.of("ticketId", "t-1"));

        assertThat(present.get(ACTOR_ID)).isEqualTo("u-1");
        assertThat(absent.has(ACTOR_ID)).isFalse();
    }

    @Test
    @DisplayName("with() lays values on top; null and blank leave the attribute absent")
    void with_adds_values_and_ignores_blanks() {
        Attrs base = Attrs.validated(spec(Set.of(TICKET_ID)), Map.of("ticketId", "t-1"));

        Attrs extended = base.with(ACTOR_ID, "u-1").with(TOOL_CALLS, null).with(AttrKey.of("x"), "  ");

        assertThat(extended.get(ACTOR_ID)).isEqualTo("u-1");
        assertThat(extended.has(TOOL_CALLS)).isFalse();
        assertThat(extended.asMap()).containsOnlyKeys("ticketId", "actorId");
        assertThat(base.has(ACTOR_ID)).as("immutable — base unchanged").isFalse();
    }

    @Test
    @DisplayName("get() on an absent attribute throws; optional() is the null-safe road")
    void absent_attribute_access() {
        Attrs attrs = Attrs.validated(spec(Set.of(TICKET_ID)), Map.of("ticketId", "t-1"));

        assertThatThrownBy(() -> attrs.get(ACTOR_ID)).isInstanceOf(NoSuchElementException.class);
        assertThat(attrs.optional(ACTOR_ID)).isEmpty();
    }

    @Test
    @DisplayName("json() parses a JSON-string value; garbage is an IllegalStateException — the value comes from a spec factory")
    void json_values() {
        Attrs attrs = Attrs.of(Map.of("toolCalls", "[\"a\",\"b\"]", "broken", "{nope"));

        assertThat(attrs.json(TOOL_CALLS, new TypeReference<List<String>>() {})).containsExactly("a", "b");
        assertThatThrownBy(() -> attrs.json(AttrKey.of("broken"), new TypeReference<List<String>>() {}))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("blank AttrKey names are rejected at construction")
    void blank_key_rejected() {
        assertThatThrownBy(() -> AttrKey.of(" ")).isInstanceOf(IllegalArgumentException.class);
        assertThat(Optional.of(AttrKey.of("ok").getName())).contains("ok");
    }

    private static NotificationTypeSpec spec(Set<AttrKey> requiredKeys) {
        NotificationTypeSpec spec = mock(NotificationTypeSpec.class);
        when(spec.getType()).thenReturn(TestType.TEST_TYPE);
        when(spec.getRequiredKeys()).thenReturn(requiredKeys);
        when(spec.getOptionalKeys()).thenReturn(Set.of());
        return spec;
    }
}
