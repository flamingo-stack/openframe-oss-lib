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

    @Test
    @DisplayName("Given all seed keys present, when seeded, then values are readable")
    void valid_seed_passes() {
        Attrs attrs = Attrs.seed(spec(Set.of(TICKET_ID)), Map.of("ticketId", "t-1"));

        assertThat(attrs.get(TICKET_ID)).isEqualTo("t-1");
        assertThat(attrs.has(TICKET_ID)).isTrue();
    }

    @Test
    @DisplayName("Given a missing or blank required seed key, when seeded, then the producer's bug is named")
    void missing_or_blank_seed_key_rejected() {
        assertThatThrownBy(() -> Attrs.seed(spec(Set.of(TICKET_ID)), Map.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ticketId");
        assertThatThrownBy(() -> Attrs.seed(spec(Set.of(TICKET_ID)), Map.of("ticketId", "  ")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ticketId");
    }

    @Test
    @DisplayName("Given a key outside the declared seed set, when seeded, then rejected — typo protection for a stringly-typed map")
    void unknown_seed_key_rejected() {
        assertThatThrownBy(() -> Attrs.seed(spec(Set.of(TICKET_ID)), Map.of("ticketId", "t-1", "ticktId", "oops")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ticktId");
    }

    @Test
    @DisplayName("with() lays enrichment values on top; null and blank leave the attribute absent")
    void with_adds_values_and_ignores_blanks() {
        Attrs seed = Attrs.seed(spec(Set.of(TICKET_ID)), Map.of("ticketId", "t-1"));

        Attrs enriched = seed.with(ACTOR_ID, "u-1").with(TOOL_CALLS, null).with(AttrKey.of("x"), "  ");

        assertThat(enriched.get(ACTOR_ID)).isEqualTo("u-1");
        assertThat(enriched.has(TOOL_CALLS)).isFalse();
        assertThat(enriched.asMap()).containsOnlyKeys("ticketId", "actorId");
        assertThat(seed.has(ACTOR_ID)).as("immutable — seed unchanged").isFalse();
    }

    @Test
    @DisplayName("get() on an absent attribute throws; optional() is the null-safe road")
    void absent_attribute_access() {
        Attrs attrs = Attrs.seed(spec(Set.of(TICKET_ID)), Map.of("ticketId", "t-1"));

        assertThatThrownBy(() -> attrs.get(ACTOR_ID)).isInstanceOf(NoSuchElementException.class);
        assertThat(attrs.optional(ACTOR_ID)).isEmpty();
    }

    @Test
    @DisplayName("json() parses a JSON-string value; garbage is an IllegalStateException — the value is spec-written, so this is a spec bug")
    void json_values() {
        Attrs attrs = Attrs.of(Map.of("toolCalls", "[\"a\",\"b\"]", "broken", "{nope"));

        assertThat(attrs.json(TOOL_CALLS, new TypeReference<List<String>>() {})).containsExactly("a", "b");
        assertThatThrownBy(() -> attrs.json(AttrKey.of("broken"), new TypeReference<List<String>>() {}))
                .isInstanceOf(IllegalStateException.class);
    }

    private static NotificationTypeSpec spec(Set<AttrKey> seedKeys) {
        NotificationTypeSpec spec = mock(NotificationTypeSpec.class);
        when(spec.type()).thenReturn("TEST_TYPE");
        when(spec.seedKeys()).thenReturn(seedKeys);
        return spec;
    }

    @Test
    @DisplayName("blank AttrKey names are rejected at construction")
    void blank_key_rejected() {
        assertThatThrownBy(() -> AttrKey.of(" ")).isInstanceOf(IllegalArgumentException.class);
        assertThat(Optional.of(AttrKey.of("ok").getName())).contains("ok");
    }
}
