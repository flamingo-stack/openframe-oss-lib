package com.openframe.notification;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.notification.service.NotificationBroadcaster;
import com.openframe.notification.service.NotificationCommand;
import com.openframe.notification.spec.AttrKey;
import com.openframe.notification.spec.Attrs;
import com.openframe.notification.spec.Audience;
import com.openframe.notification.spec.NotificationText;
import com.openframe.notification.spec.NotificationTypeRegistry;
import com.openframe.notification.spec.NotificationTypeSpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotifierTest {

    private static final AttrKey TICKET_ID = AttrKey.of("ticketId");
    private static final AttrKey ASSIGNEE = AttrKey.of("assigneeUserId");

    private NotificationBroadcaster broadcaster;
    private Notifier notifier;
    private TestSpec spec;

    @BeforeEach
    void setUp() {
        broadcaster = mock(NotificationBroadcaster.class);
        spec = new TestSpec();
        NotificationTypeRegistry registry = new NotificationTypeRegistry(provider(spec));
        notifier = new Notifier(registry, broadcaster);
    }

    @Test
    @DisplayName("The pipeline in one pass: seed → enrich → compose/audience → command with type, attributes and legacy context")
    void happy_path_builds_the_full_command() {
        notifier.notify("TEST_TYPE", Map.of("ticketId", "t-1"), "corr-1");

        ArgumentCaptor<NotificationCommand> command = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(broadcaster).broadcast(command.capture());
        NotificationCommand sent = command.getValue();
        assertThat(sent.getType()).isEqualTo("TEST_TYPE");
        assertThat(sent.getAttributes()).containsEntry("ticketId", "t-1").containsEntry("assigneeUserId", "u-9");
        assertThat(sent.getTitle()).isEqualTo("Ticket t-1");
        assertThat(sent.getDescription()).isEqualTo("Assigned to u-9");
        assertThat(sent.getSeverity()).isEqualTo(NotificationSeverity.INFO);
        assertThat(sent.getAdminAudience()).containsExactly("u-9");
        assertThat(sent.getCorrelationId()).isEqualTo("corr-1");
        assertThat(sent.getContext().getType()).isEqualTo("TEST_TYPE");
    }

    @Test
    @DisplayName("An empty audience is a legal outcome — nothing is broadcast, nothing thrown")
    void empty_audience_skips() {
        spec.audience = Audience.none();

        notifier.notify("TEST_TYPE", Map.of("ticketId", "t-1"));

        verify(broadcaster, never()).broadcast(any());
    }

    @Test
    void unknown_type_and_broken_seed_throw() {
        assertThatThrownBy(() -> notifier.notify("NOPE", Map.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> notifier.notify("TEST_TYPE", Map.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ticketId");
        verify(broadcaster, never()).broadcast(any());
    }

    @SuppressWarnings("unchecked")
    private static org.springframework.beans.factory.ObjectProvider<NotificationTypeSpec> provider(NotificationTypeSpec... specs) {
        org.springframework.beans.factory.ObjectProvider<NotificationTypeSpec> provider =
                mock(org.springframework.beans.factory.ObjectProvider.class);
        when(provider.stream()).thenReturn(java.util.stream.Stream.of(specs));
        return provider;
    }

    // Hand-rolled, not a mock: the pipeline calls every spec method and a mock would silently null.
    private static class TestSpec implements NotificationTypeSpec {
        Audience audience = Audience.users("u-9");

        @Override public String getType() { return "TEST_TYPE"; }
        @Override public Set<AttrKey> getRequiredSeedKeys() { return Set.of(TICKET_ID); }

        @Override public Attrs enrich(Attrs seed) {
            return seed.with(ASSIGNEE, "u-9");
        }

        @Override public Optional<com.openframe.data.document.notification.NotificationSettingGroup> getSettingsGroup() {
            return Optional.empty();
        }

        @Override public com.openframe.data.document.notification.NotificationCategory getCategory() {
            return com.openframe.data.document.notification.NotificationCategory.TICKETS;
        }

        @Override public NotificationSeverity getSeverity() { return NotificationSeverity.INFO; }
        @Override public Audience audience(Attrs attrs) { return audience; }

        @Override public NotificationText compose(Attrs attrs) {
            return new NotificationText("Ticket " + attrs.get(TICKET_ID), "Assigned to " + attrs.get(ASSIGNEE));
        }

        @Override public com.openframe.data.document.notification.NotificationContext buildLegacyContext(Attrs attrs) {
            return GenericContext.builder().type(getType()).payload("{}").build();
        }
    }
}
