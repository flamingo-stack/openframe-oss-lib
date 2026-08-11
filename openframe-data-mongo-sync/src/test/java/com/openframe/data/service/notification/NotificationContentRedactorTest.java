package com.openframe.data.service.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationContentPolicy;
import com.openframe.data.repository.notification.NotificationContentPolicyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationContentRedactorTest {

    private NotificationContentPolicyRepository policyRepository;
    private NotificationContentRedactor redactor;

    @BeforeEach
    void setUp() {
        policyRepository = mock(NotificationContentPolicyRepository.class);
        redactor = new NotificationContentRedactor(Optional.of(policyRepository));
        // Off by default so each test observes its own stubbing; the cache gets its own test.
        ReflectionTestUtils.setField(redactor, "policyCacheSeconds", 0L);
    }

    @Test
    @DisplayName("Given no policy document, when a description is read, then the stored content passes through — absence means the informative default")
    void absent_policy_is_not_suppressed() {
        when(policyRepository.find()).thenReturn(Optional.empty());

        assertThat(redactor.descriptionFor(notification(), NotificationCategory.TICKETS))
                .isEqualTo("The printer is offline again");
    }

    @Test
    @DisplayName("Given suppression is off, when a description is read, then the stored content passes through")
    void suppression_off_passes_content_through() {
        stubPolicy(false);

        assertThat(redactor.descriptionFor(notification(), NotificationCategory.TICKETS))
                .isEqualTo("The printer is offline again");
    }

    @Test
    @DisplayName("Given suppression is on, when a description is read, then a category-specific neutral line replaces the content")
    void suppression_on_replaces_content_per_category() {
        stubPolicy(true);

        assertThat(redactor.descriptionFor(notification(), NotificationCategory.TICKETS))
                .isEqualTo("New activity on this ticket");
        assertThat(redactor.descriptionFor(notification(), NotificationCategory.MINGO))
                .isEqualTo("New message");
    }

    @Test
    @DisplayName("Given a category with no specific wording, when suppressed, then the generic default is used")
    void unmapped_category_falls_back_to_the_generic_line() {
        stubPolicy(true);

        assertThat(redactor.descriptionFor(notification(), NotificationCategory.GENERIC))
                .isEqualTo("New notification");
    }

    @Test
    @DisplayName("Given a null category argument, when suppressed, then the notification's own category decides the wording")
    void null_category_falls_back_to_the_stored_one() {
        stubPolicy(true);
        Notification notification = notification();
        notification.setCategory(NotificationCategory.TICKETS);

        assertThat(redactor.descriptionFor(notification, null)).isEqualTo("New activity on this ticket");
    }

    @Test
    @DisplayName("Given the policy lookup throws, when a description is read, then content is NOT suppressed — a broken lookup must not blank the tenant")
    void lookup_failure_fails_open() {
        when(policyRepository.find()).thenThrow(new IllegalStateException("mongo down"));

        assertThat(redactor.descriptionFor(notification(), NotificationCategory.TICKETS))
                .isEqualTo("The printer is offline again");
    }

    @Test
    @DisplayName("Given no policy repository (a shared service), when a description is read, then content passes through and nothing is looked up")
    void absent_repository_is_not_suppressed() {
        NotificationContentRedactor withoutRepository = new NotificationContentRedactor(Optional.empty());

        assertThat(withoutRepository.descriptionFor(notification(), NotificationCategory.TICKETS))
                .isEqualTo("The printer is offline again");
        assertThat(withoutRepository.contentSuppressed()).isFalse();
    }

    @Test
    @DisplayName("Given a refresh window, when the policy is read repeatedly, then Mongo is hit once — the push outbox drains in batches")
    void policy_is_cached_within_the_refresh_window() {
        ReflectionTestUtils.setField(redactor, "policyCacheSeconds", 60L);
        stubPolicy(true);

        redactor.contentSuppressed();
        redactor.contentSuppressed();
        redactor.contentSuppressed();

        verify(policyRepository, times(1)).find();
    }

    @Test
    @DisplayName("Given the flag was toggled, when the cache is invalidated, then the next read sees the new value immediately")
    void invalidate_forces_a_fresh_read() {
        ReflectionTestUtils.setField(redactor, "policyCacheSeconds", 60L);
        stubPolicy(true);
        assertThat(redactor.contentSuppressed()).isTrue();

        stubPolicy(false);
        redactor.invalidate();

        assertThat(redactor.contentSuppressed()).isFalse();
        verify(policyRepository, times(2)).find();
    }

    @Test
    @DisplayName("Given a null notification, when a description is read, then null — nothing to redact")
    void null_notification_is_passed_through() {
        assertThat(redactor.descriptionFor(null, NotificationCategory.TICKETS)).isNull();
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
