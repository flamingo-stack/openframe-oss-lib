package com.openframe.notification;

import com.openframe.data.document.notification.GenericContext;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.notification.service.NotificationBroadcaster;
import com.openframe.notification.service.NotificationCommand;
import com.openframe.notification.spec.AttrKey;
import com.openframe.notification.spec.Attrs;
import com.openframe.notification.spec.Audience;
import com.openframe.notification.spec.EntityRef;
import com.openframe.notification.spec.NotificationSeed;
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

    private record TestSeed(String ticketId, String assigneeUserId) implements NotificationSeed {
        @Override public NotificationType type() { return TestType.TEST_TYPE; }
    }

    private record UnregisteredSeed() implements NotificationSeed {
        @Override public NotificationType type() { return TestType.UNREGISTERED; }
    }

    // Claims TEST_TYPE but is not the class TestSpec was built for — a wiring bug, not bad input.
    private record ForeignSeed() implements NotificationSeed {
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
    @DisplayName("The pipeline in one pass: typed seed → attrs mapping → compose/audience → command with type, attributes and legacy context")
    void happy_path_builds_the_full_command() {
        NotificationRequest request = NotificationRequest.of(new TestSeed("t-1", "u-9"));

        emitter.notify(request, "corr-1");

        ArgumentCaptor<NotificationCommand> command = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(broadcaster).broadcast(command.capture());
        NotificationCommand sent = command.getValue();
        assertThat(sent.getType()).isEqualTo(TestType.TEST_TYPE);
        assertThat(sent.getAttributes())
                .as("attrs() mapped the self-contained seed to the stored snapshot")
                .containsEntry("ticketId", "t-1")
                .containsEntry("assigneeUserId", "u-9");
        assertThat(sent.getTitle()).isEqualTo("Ticket t-1");
        assertThat(sent.getDescription()).isEqualTo("Assigned to u-9");
        assertThat(sent.getSeverity()).isEqualTo(NotificationSeverity.INFO);
        assertThat(sent.getAudience()).isSameAs(spec.audience);
        assertThat(sent.getCorrelationId()).isEqualTo("corr-1");
        assertThat(sent.getContext().getType()).isEqualTo("TEST_TYPE");
        assertThat(sent.getApplePushCategory()).isEqualTo("TEST_CATEGORY");
    }

    @Test
    @DisplayName("Producer bugs are swallowed with an ERROR log — a notification must never fail the business flow")
    void producer_bugs_are_swallowed() {
        NotificationRequest unregistered = NotificationRequest.of(new UnregisteredSeed());
        NotificationRequest wrongSeedClass = NotificationRequest.of(new ForeignSeed());

        assertThatCode(() -> emitter.notify(unregistered)).doesNotThrowAnyException();
        assertThatCode(() -> emitter.notify(wrongSeedClass)).doesNotThrowAnyException();
        verify(broadcaster, never()).broadcast(any());
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<NotificationTypeSpec<?>> provider(NotificationTypeSpec<?>... specs) {
        ObjectProvider<NotificationTypeSpec<?>> provider = mock(ObjectProvider.class);
        when(provider.stream()).thenReturn(Stream.of(specs));
        return provider;
    }

    // Hand-rolled, not a mock: the pipeline calls every spec method and a mock would silently null.
    private static class TestSpec implements NotificationTypeSpec<TestSeed> {

        Audience audience = Audience.users("u-9");

        @Override public NotificationType getType() { return TestType.TEST_TYPE; }
        @Override public Class<TestSeed> getSeedClass() { return TestSeed.class; }
        @Override public Optional<NotificationSettingGroup> getSettingsGroup() { return Optional.empty(); }
        @Override public NotificationCategory getCategory() { return NotificationCategory.TICKETS; }
        @Override public NotificationSeverity getSeverity() { return NotificationSeverity.INFO; }
        @Override public Audience audience(TestSeed seed) { return audience; }

        @Override public Optional<EntityRef> entity(TestSeed seed) {
            return Optional.of(EntityRef.ticket(seed.ticketId()));
        }

        @Override public Attrs attrs(TestSeed seed) {
            return Attrs.of(Map.of("ticketId", seed.ticketId())).with(ASSIGNEE, seed.assigneeUserId());
        }

        @Override public String composeTitle(TestSeed seed) {
            return "Ticket " + seed.ticketId();
        }

        @Override public String composeDescription(TestSeed seed) {
            return "Assigned to " + seed.assigneeUserId();
        }

        @Override public Optional<String> getApplePushCategory() {
            return Optional.of("TEST_CATEGORY");
        }

        @Override public NotificationContext buildLegacyContext(TestSeed seed) {
            return GenericContext.builder().type(getType().name()).payload("{}").build();
        }
    }
}
