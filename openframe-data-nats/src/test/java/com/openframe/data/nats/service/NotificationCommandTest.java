package com.openframe.data.nats.service;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.NotificationSeverity;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NotificationCommandTest {

    @Test
    @DisplayName("Given all required fields and at least one non-empty audience, when build() runs, then the Command is constructed and exposes the supplied values verbatim")
    void valid_command_builds_and_carries_fields() {
        NotificationCommand cmd = NotificationCommand.builder()
                .title("Approval required")
                .description("desc")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("APPROVAL"))
                .adminAudience(Set.of("admin-1"))
                .machineAudience(Set.of("m-1"))
                .build();

        assertThat(cmd.getTitle()).isEqualTo("Approval required");
        assertThat(cmd.getDescription()).isEqualTo("desc");
        assertThat(cmd.getSeverity()).isEqualTo(NotificationSeverity.INFO);
        assertThat(cmd.getContext().getType()).isEqualTo("APPROVAL");
        assertThat(cmd.getAdminAudience()).containsExactly("admin-1");
        assertThat(cmd.getMachineAudience()).containsExactly("m-1");
    }

    @Test
    @DisplayName("Given a blank title, when build() runs, then IllegalArgumentException is raised — title is the user-visible label and must not be empty")
    void blank_title_rejected() {
        assertThatThrownBy(() -> baseBuilder().title("   ").build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("title");
    }

    @Test
    @DisplayName("Given a null title, when build() runs, then IllegalArgumentException is raised — title is required")
    void null_title_rejected() {
        assertThatThrownBy(() -> baseBuilder().title(null).build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("title");
    }

    @Test
    @DisplayName("Given a null severity, when build() runs, then NullPointerException is raised — severity is required to drive UI styling")
    void null_severity_rejected() {
        assertThatThrownBy(() -> baseBuilder().severity(null).build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("severity");
    }

    @Test
    @DisplayName("Given a null context, when build() runs, then NullPointerException is raised — context is the discriminator + payload for FE rendering and must be present")
    void null_context_rejected() {
        assertThatThrownBy(() -> baseBuilder().context(null).build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("context");
    }

    @Test
    @DisplayName("Given a context whose type is blank, when build() runs, then IllegalArgumentException is raised — type drives polymorphic dispatch and read_state denormalization")
    void blank_context_type_rejected() {
        GenericContext ctxWithBlankType = GenericContext.builder().type("   ").payload("{}").build();
        assertThatThrownBy(() -> baseBuilder().context(ctxWithBlankType).build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("context.type");
    }

    @Test
    @DisplayName("Given both adminAudience and machineAudience are empty (or null), when build() runs, then IllegalArgumentException is raised — a notification with nobody to deliver to is a programming error")
    void empty_audiences_rejected() {
        assertThatThrownBy(() -> NotificationCommand.builder()
                .title("X")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("X"))
                .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContainingAll("adminAudience", "machineAudience");

        assertThatThrownBy(() -> NotificationCommand.builder()
                .title("X")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("X"))
                .adminAudience(Set.of())
                .machineAudience(Set.of())
                .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContainingAll("adminAudience", "machineAudience");
    }

    @Test
    @DisplayName("Given only adminAudience is provided, when build() runs, then the Command is valid and machineAudience defaults to an empty set")
    void admin_only_audience_valid() {
        NotificationCommand cmd = NotificationCommand.builder()
                .title("X")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("X"))
                .adminAudience(Set.of("admin-1"))
                .build();

        assertThat(cmd.getAdminAudience()).containsExactly("admin-1");
        assertThat(cmd.getMachineAudience()).isEmpty();
    }

    @Test
    @DisplayName("Given only machineAudience is provided, when build() runs, then the Command is valid and adminAudience defaults to an empty set")
    void machine_only_audience_valid() {
        NotificationCommand cmd = NotificationCommand.builder()
                .title("X")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("X"))
                .machineAudience(Set.of("m-1"))
                .build();

        assertThat(cmd.getMachineAudience()).containsExactly("m-1");
        assertThat(cmd.getAdminAudience()).isEmpty();
    }

    @Test
    @DisplayName("Given a mutable audience Set passed to the builder, when the caller mutates that set after build() returns, then the Command's audience snapshot is unaffected — internal copy isolates the command from caller-side mutation")
    void audience_snapshot_isolated_from_caller_mutation() {
        Set<String> mutableAdmins = new HashSet<>(Set.of("admin-1"));
        NotificationCommand cmd = NotificationCommand.builder()
                .title("X")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("X"))
                .adminAudience(mutableAdmins)
                .build();

        mutableAdmins.add("admin-2");

        assertThat(cmd.getAdminAudience()).containsExactly("admin-1");
    }

    @Test
    @DisplayName("Given null adminAudience and a non-empty machineAudience, when build() runs, then it does not NPE and adminAudience normalizes to an empty set")
    void null_audience_normalizes_to_empty() {
        NotificationCommand cmd = NotificationCommand.builder()
                .title("X")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("X"))
                .adminAudience(null)
                .machineAudience(Set.of("m-1"))
                .build();

        assertThat(cmd.getAdminAudience()).isEmpty();
        assertThat(cmd.getMachineAudience()).containsExactly("m-1");
    }

    private static NotificationCommand.NotificationCommandBuilder baseBuilder() {
        return NotificationCommand.builder()
                .title("Default title")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("X"))
                .adminAudience(Set.of("admin-1"));
    }

    private static GenericContext genericContext(String type) {
        return GenericContext.builder().type(type).payload("{}").build();
    }
}
