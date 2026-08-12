package com.openframe.data.service.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContentPolicy;
import com.openframe.data.repository.notification.NotificationContentPolicyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class NotificationContentRedactorTest {

    private NotificationContentPolicyRepository policyRepository;
    private NotificationContentRedactor redactor;

    @BeforeEach
    void setUp() {
        policyRepository = mock(NotificationContentPolicyRepository.class);
        redactor = new NotificationContentRedactor(policyRepository);
    }

    @Test
    @DisplayName("Given no policy document, when the policy is read, then content is NOT suppressed — absence means the informative default")
    void absent_policy_is_not_suppressed() {
        when(policyRepository.find()).thenReturn(Optional.empty());

        assertThat(redactor.contentSuppressed()).isFalse();
    }

    @Test
    @DisplayName("Given the policy lookup throws, when the policy is read, then content is NOT suppressed — a broken lookup must not blank the tenant")
    void lookup_failure_fails_open() {
        when(policyRepository.find()).thenThrow(new IllegalStateException("mongo down"));

        assertThat(redactor.contentSuppressed()).isFalse();
    }

    @Test
    @DisplayName("Given a stored policy, when the policy is read, then its flag is reported")
    void stored_policy_is_reported() {
        stubPolicy(true);

        assertThat(redactor.contentSuppressed()).isTrue();
    }

    @Test
    @DisplayName("Given suppression is off, when a description is redacted, then the stored content passes through")
    void suppression_off_passes_content_through() {
        assertThat(redactor.descriptionFor(notification(), NotificationCategory.TICKETS, false))
                .isEqualTo("The printer is offline again");
    }

    @Test
    @DisplayName("Given suppression is on, when a description is redacted, then a category-specific neutral line replaces the content")
    void suppression_on_replaces_content_per_category() {
        assertThat(redactor.descriptionFor(notification(), NotificationCategory.TICKETS, true))
                .isEqualTo("New activity on this ticket");
        assertThat(redactor.descriptionFor(notification(), NotificationCategory.MINGO, true))
                .isEqualTo("New message");
    }

    @Test
    @DisplayName("Given a category with no specific wording, when suppressed, then the generic default is used")
    void unmapped_category_falls_back_to_the_generic_line() {
        assertThat(redactor.descriptionFor(notification(), NotificationCategory.GENERIC, true))
                .isEqualTo("New notification");
    }

    @Test
    @DisplayName("Given a null category argument, when suppressed, then the notification's own category decides the wording")
    void null_category_falls_back_to_the_stored_one() {
        Notification notification = notification();
        notification.setCategory(NotificationCategory.TICKETS);

        assertThat(redactor.descriptionFor(notification, null, true)).isEqualTo("New activity on this ticket");
    }

    @Test
    @DisplayName("Given an already-resolved policy, when descriptions are redacted, then Mongo is never touched — this is what lets a caller redact a whole page on one lookup")
    void applying_a_resolved_policy_does_no_io() {
        redactor.descriptionFor(notification(), NotificationCategory.TICKETS, true);
        redactor.descriptionFor(notification(), NotificationCategory.MINGO, false);

        verifyNoInteractions(policyRepository);
    }

    @Test
    @DisplayName("Given the single-notification convenience form, when it is called, then it resolves the policy itself — once per call, for callers that handle one notification")
    void convenience_form_resolves_the_policy_itself() {
        stubPolicy(true);

        assertThat(redactor.descriptionFor(notification(), NotificationCategory.TICKETS))
                .isEqualTo("New activity on this ticket");
        verify(policyRepository, times(1)).find();
    }

    @Test
    @DisplayName("Given the flag is toggled, when it is read again, then the new value is seen at once — nothing is cached, so there is no staleness window on a privacy control")
    void policy_is_never_stale() {
        stubPolicy(true);
        assertThat(redactor.contentSuppressed()).isTrue();

        stubPolicy(false);

        assertThat(redactor.contentSuppressed()).isFalse();
    }

    @Test
    @DisplayName("Given a null notification, when a description is redacted, then null — nothing to redact")
    void null_notification_is_passed_through() {
        assertThat(redactor.descriptionFor(null, NotificationCategory.TICKETS, true)).isNull();
    }

    private void stubPolicy(boolean suppressed) {
        when(policyRepository.find())
                .thenReturn(Optional.of(NotificationContentPolicy.builder().contentSuppressed(suppressed).build()));
    }

    private static Notification notification() {
        return Notification.builder()
                .id("notif-1")
                .title("Ticket #1234 — Printer offline at front desk")
                .description("The printer is offline again")
                .build();
    }
}
