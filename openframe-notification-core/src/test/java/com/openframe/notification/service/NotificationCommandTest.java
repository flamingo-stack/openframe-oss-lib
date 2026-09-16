package com.openframe.notification.service;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.notification.spec.Audience;
import com.openframe.notification.spec.NotificationType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NotificationCommandTest {

    private enum TestType implements NotificationType { APPROVAL }

    @Test
    @DisplayName("Given all required fields, when build() runs, then the Command carries the supplied values verbatim")
    void valid_command_builds_and_carries_fields() {
        Audience audience = Audience.users("admin-1").andMachines("m-1");
        NotificationCommand cmd = NotificationCommand.builder()
                .title("Approval required")
                .description("desc")
                .severity(NotificationSeverity.INFO)
                .type(TestType.APPROVAL)
                .category(NotificationCategory.MINGO)
                .attributes(Map.of("approvalRequestId", "req-1"))
                .audience(audience)
                .build();

        assertThat(cmd.getTitle()).isEqualTo("Approval required");
        assertThat(cmd.getDescription()).isEqualTo("desc");
        assertThat(cmd.getSeverity()).isEqualTo(NotificationSeverity.INFO);
        assertThat(cmd.getType()).isEqualTo(TestType.APPROVAL);
        assertThat(cmd.getCategory()).isEqualTo(NotificationCategory.MINGO);
        assertThat(cmd.getAttributes()).containsEntry("approvalRequestId", "req-1");
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
    void null_type_rejected() {
        assertThatThrownBy(() -> baseBuilder().type(null).build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("type");
    }

    @Test
    void null_attributes_rejected() {
        assertThatThrownBy(() -> baseBuilder().attributes(null).build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("attributes");
    }

    @Test
    void null_category_rejected() {
        assertThatThrownBy(() -> baseBuilder().category(null).build())
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("category");
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
                .type(TestType.APPROVAL)
                .category(NotificationCategory.GENERIC)
                .attributes(Map.of())
                .audience(Audience.users("admin-1"));
    }
}
