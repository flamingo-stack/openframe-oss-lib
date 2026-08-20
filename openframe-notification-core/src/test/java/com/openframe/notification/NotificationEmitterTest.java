package com.openframe.notification;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.notification.service.NotificationBroadcaster;
import com.openframe.notification.service.NotificationCommand;
import com.openframe.notification.spec.AttrKey;
import com.openframe.notification.spec.Attrs;
import com.openframe.notification.spec.Audience;
import com.openframe.notification.spec.NotificationContext;
import com.openframe.notification.spec.NotificationText;
import com.openframe.notification.spec.NotificationType;
import com.openframe.notification.spec.NotificationTypeRegistry;
import com.openframe.notification.spec.NotificationTypeSpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationEmitterTest {

    private static final AttrKey TICKET_ID = AttrKey.of("ticketId");
    private static final AttrKey ASSIGNEE = AttrKey.of("assigneeUserId");

    private enum TestType implements NotificationType { TEST_TYPE, UNREGISTERED }

    private record TestContext(String ticketId) implements NotificationContext {
        @Override public NotificationType type() { return TestType.TEST_TYPE; }
    }

    private record UnregisteredContext() implements NotificationContext {
        @Override public NotificationType type() { return TestType.UNREGISTERED; }
    }

    // Claims TEST_TYPE but is not the class TestSpec was built for — a wiring bug, not bad input.
    private record ForeignContext() implements NotificationContext {
        @Override public NotificationType type() { return TestType.TEST_TYPE; }
    }

    private NotificationBroadcaster broadcaster;
    private NotificationEmitter emitter;
    private TestSpec spec;

    @BeforeEach
    void setUp() {
        broadcaster = mock(NotificationBroadcaster.class);
        spec = new TestSpec();
        NotificationTypeRegistry registry = new NotificationTypeRegistry(provider(spec));
        emitter = new NotificationEmitter(registry, broadcaster);
    }

    @Test
    @DisplayName("The pipeline in one pass: typed context → enrich → compose/audience → command with type, attributes and legacy context")
    void happy_path_builds_the_full_command() {
        NotificationRequest request = NotificationRequest.of(new TestContext("t-1"));

        emitter.notify(request, "corr-1");

        ArgumentCaptor<NotificationCommand> command = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(broadcaster).broadcast(command.capture());
        NotificationCommand sent = command.getValue();
        assertThat(sent.getType()).isEqualTo(TestType.TEST_TYPE);
        assertThat(sent.getAttributes())
                .as("enrich() laid the snapshot fact on top of the context's event fact")
                .containsEntry("ticketId", "t-1")
                .containsEntry("assigneeUserId", "u-9");
        assertThat(sent.getTitle()).isEqualTo("Ticket t-1");
        assertThat(sent.getDescription()).isEqualTo("Assigned to u-9");
        assertThat(sent.getSeverity()).isEqualTo(NotificationSeverity.INFO);
        assertThat(sent.getAudience()).isSameAs(spec.audience);
        assertThat(sent.getCorrelationId()).isEqualTo("corr-1");
        assertThat(sent.getContext().getType()).isEqualTo("TEST_TYPE");
    }

    @Test
    @DisplayName("Producer bugs are swallowed with an ERROR log — a notification must never fail the business flow")
    void producer_bugs_are_swallowed() {
        NotificationRequest unregistered = NotificationRequest.of(new UnregisteredContext());
        NotificationRequest wrongContextClass = NotificationRequest.of(new ForeignContext());

        assertThatCode(() -> emitter.notify(unregistered)).doesNotThrowAnyException();
        assertThatCode(() -> emitter.notify(wrongContextClass)).doesNotThrowAnyException();
        verify(broadcaster, never()).broadcast(any());
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<NotificationTypeSpec<?>> provider(NotificationTypeSpec<?>... specs) {
        ObjectProvider<NotificationTypeSpec<?>> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenReturn(Stream.of(specs));
        return provider;
    }

    // Hand-rolled, not a mock: the pipeline calls every spec method and a mock would silently null.
    private static class TestSpec implements NotificationTypeSpec<TestContext> {

        Audience audience = Audience.users("u-9");

        @Override public NotificationType getType() { return TestType.TEST_TYPE; }
        @Override public Class<TestContext> getContextClass() { return TestContext.class; }
        @Override public Optional<NotificationSettingGroup> getSettingsGroup() { return Optional.empty(); }
        @Override public NotificationCategory getCategory() { return NotificationCategory.TICKETS; }
        @Override public NotificationSeverity getSeverity() { return NotificationSeverity.INFO; }
        @Override public Audience audience(Attrs attrs) { return audience; }

        @Override public Attrs enrich(TestContext context) {
            return Attrs.of(Map.of("ticketId", context.ticketId())).with(ASSIGNEE, "u-9");
        }

        @Override public NotificationText compose(Attrs attrs) {
            return new NotificationText("Ticket " + attrs.get(TICKET_ID), "Assigned to " + attrs.get(ASSIGNEE));
        }

        @Override public com.openframe.data.document.notification.NotificationContext buildLegacyContext(Attrs attrs) {
            return GenericContext.builder().type(getType().name()).payload("{}").build();
        }
    }
}
