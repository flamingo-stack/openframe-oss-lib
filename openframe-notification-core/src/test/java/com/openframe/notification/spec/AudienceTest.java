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

        assertThat(audience.userIds).containsExactlyInAnyOrder("u-1", "u-2");
        assertThat(audience.machineIds).containsExactly("m-1");
    }

    @Test
    @DisplayName("except() cuts the explicit id now and records it for marker resolution later")
    void except_is_two_phase() {
        Audience explicit = Audience.users("assignee").except("assignee");
        Audience declared = Audience.allActiveAdmins().except("actor");

        assertThat(explicit.userIds).isEmpty();
        assertThat(explicit.excludedUserIds).containsExactly("assignee");
        assertThat(declared.allActiveAdmins).isTrue();
        assertThat(declared.excludedUserIds).containsExactly("actor");
        assertThat(Audience.users("a").except(null).userIds).containsExactly("a");
    }

    @Test
    @DisplayName("andUsers/andMachines merge without duplicates and keep the marker")
    void combination() {
        Audience audience = Audience.allActiveAdmins()
                .andUsers(List.of("a", "b"))
                .andUsers(List.of("a"))
                .andMachines(List.of("m-1"));

        assertThat(audience.userIds).containsExactlyInAnyOrder("a", "b");
        assertThat(audience.machineIds).containsExactly("m-1");
        assertThat(audience.allActiveAdmins).isTrue();
    }

    @Test
    void none_declares_nobody() {
        Audience none = Audience.none();

        assertThat(none.userIds).isEmpty();
        assertThat(none.machineIds).isEmpty();
        assertThat(none.allActiveAdmins).isFalse();
    }
}
