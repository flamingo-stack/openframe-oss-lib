package com.openframe.notification.service;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.notification.spec.Audience;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NotificationCommandTest {

    @Test
    @DisplayName("Given all required fields, when build() runs, then the Command carries the supplied values verbatim")
    void valid_command_builds_and_carries_fields() {
        Audience audience = Audience.users("admin-1").andMachines("m-1");
        NotificationCommand cmd = NotificationCommand.builder()
                .title("Approval required")
                .description("desc")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("APPROVAL"))
                .audience(audience)
                .build();

        assertThat(cmd.getTitle()).isEqualTo("Approval required");
        assertThat(cmd.getDescription()).isEqualTo("desc");
        assertThat(cmd.getSeverity()).isEqualTo(NotificationSeverity.INFO);
        assertThat(cmd.getContext().getType()).isEqualTo("APPROVAL");
        assertThat(cmd.getAudience()).isSameAs(audience);
    }

    @Test
    @DisplayName("Given a blank or null title, when build() runs, then IllegalArgumentException — title is the user-visible label")
    void blank_title_rejected() {
        assertThatThrownBy(() -> baseBuilder().title("   ").build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("title");
        assertThatThrownBy(() -> baseBuilder().title(null).build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("title");
    }

    @Test
    void null_severity_rejected() {
        assertThatThrownBy(() -> baseBuilder().severity(null).build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("severity");
    }

    @Test
    void null_context_rejected() {
        assertThatThrownBy(() -> baseBuilder().context(null).build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("context");
    }

    @Test
    @DisplayName("Given a context whose type is blank, when build() runs, then IllegalArgumentException — type drives polymorphic dispatch")
    void blank_context_type_rejected() {
        GenericContext ctxWithBlankType = GenericContext.builder().type("   ").payload("{}").build();
        assertThatThrownBy(() -> baseBuilder().context(ctxWithBlankType).build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("context.type");
    }

    @Test
    @DisplayName("Given a null audience, when build() runs, then NullPointerException — even 'nobody' must be declared explicitly via Audience.none()")
    void null_audience_rejected() {
        assertThatThrownBy(() -> baseBuilder().audience(null).build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("audience");
    }

    private static NotificationCommand.NotificationCommandBuilder baseBuilder() {
        return NotificationCommand.builder()
                .title("Default title")
                .severity(NotificationSeverity.INFO)
                .context(genericContext("X"))
                .audience(Audience.users("admin-1"));
    }

    private static GenericContext genericContext(String type) {
        return GenericContext.builder().type(type).payload("{}").build();
    }
}
