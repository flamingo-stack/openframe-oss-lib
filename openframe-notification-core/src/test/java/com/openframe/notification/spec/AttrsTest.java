package com.openframe.notification.spec;

import com.fasterxml.jackson.core.type.TypeReference;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AttrsTest {

    private static final AttrKey TICKET_ID = AttrKey.of("ticketId");
    private static final AttrKey ACTOR_ID = AttrKey.of("actorId");
    private static final AttrKey TOOL_CALLS = AttrKey.of("toolCalls");

    @Test
    @DisplayName("of() snapshots the map; values are readable by key")
    void values_readable() {
        Attrs attrs = Attrs.of(Map.of("ticketId", "t-1"));

        assertThat(attrs.get(TICKET_ID)).isEqualTo("t-1");
        assertThat(attrs.has(TICKET_ID)).isTrue();
        assertThat(attrs.asMap()).containsOnlyKeys("ticketId");
    }

    @Test
    @DisplayName("with() lays values on top; null and blank leave the attribute absent")
    void with_adds_values_and_ignores_blanks() {
        Attrs base = Attrs.of(Map.of("ticketId", "t-1"));

        Attrs extended = base.with(ACTOR_ID, "u-1").with(TOOL_CALLS, null).with(AttrKey.of("x"), "  ");

        assertThat(extended.get(ACTOR_ID)).isEqualTo("u-1");
        assertThat(extended.has(TOOL_CALLS)).isFalse();
        assertThat(extended.asMap()).containsOnlyKeys("ticketId", "actorId");
        assertThat(base.has(ACTOR_ID)).as("immutable — base unchanged").isFalse();
    }

    @Test
    @DisplayName("get() on an absent attribute throws; optional() is the null-safe road")
    void absent_attribute_access() {
        Attrs attrs = Attrs.of(Map.of("ticketId", "t-1"));

        assertThatThrownBy(() -> attrs.get(ACTOR_ID)).isInstanceOf(NoSuchElementException.class);
        assertThat(attrs.optional(ACTOR_ID)).isEmpty();
    }

    @Test
    @DisplayName("a blank value counts as absent — get() throws, has() is false")
    void blank_value_counts_as_absent() {
        Attrs attrs = Attrs.of(Map.of("ticketId", "  "));

        assertThat(attrs.has(TICKET_ID)).isFalse();
        assertThatThrownBy(() -> attrs.get(TICKET_ID)).isInstanceOf(NoSuchElementException.class);
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
}
