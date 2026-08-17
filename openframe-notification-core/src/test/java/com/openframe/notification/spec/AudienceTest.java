package com.openframe.notification.spec;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AudienceTest {

    @Test
    @DisplayName("null and blank ids are dropped — an absent assignee means nobody, not an error")
    void nulls_and_blanks_dropped() {
        Audience audience = Audience.users(Arrays.asList("u-1", null, " ", "u-2")).andMachines("m-1", "");

        assertThat(audience.users()).containsExactlyInAnyOrder("u-1", "u-2");
        assertThat(audience.machines()).containsExactly("m-1");
    }

    @Test
    @DisplayName("except() cuts the initiator; a self-assignment collapses to an empty audience")
    void except_cuts_the_actor() {
        assertThat(Audience.users("assignee").except("assignee").isEmpty()).isTrue();
        assertThat(Audience.users("assignee").except("someone-else").users()).containsExactly("assignee");
        assertThat(Audience.users("a").except(null).users()).containsExactly("a");
    }

    @Test
    @DisplayName("andUsers/andMachines merge without duplicates")
    void combination() {
        Audience audience = Audience.users("a").andUsers(List.of("a", "b")).andMachines(List.of("m-1"));

        assertThat(audience.users()).containsExactlyInAnyOrder("a", "b");
        assertThat(audience.machines()).containsExactly("m-1");
        assertThat(audience.isEmpty()).isFalse();
    }

    @Test
    void none_is_empty() {
        assertThat(Audience.none().isEmpty()).isTrue();
        assertThat(Audience.users((String) null).isEmpty()).isTrue();
    }
}
