package com.openframe.data.integration.repository.notification;

import com.openframe.data.document.notification.Notification;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import com.openframe.data.integration.support.NotificationFixtures;
import com.openframe.data.repository.notification.NotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomNotificationRepositoryRetryCandidatesIT extends BaseMongoIntegrationTest {

    private static final int MAX_ATTEMPTS = 5;

    @Autowired
    private NotificationRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        mongoTemplate.dropCollection(Notification.class);
    }

    @Test
    @DisplayName("Given a freshly built notification (default publishState), when finding retry candidates, then it is included")
    void given_freshly_built_row_when_finding_retry_candidates_then_it_is_included() {
        Notification fresh = repository.save(NotificationFixtures.basic("u1"));

        List<Notification> candidates = repository.findRetryablePublishCandidates(MAX_ATTEMPTS, 100);

        assertThat(candidates).extracting(Notification::getId).contains(fresh.getId());
    }

    @Test
    @DisplayName("Given an unpublished row whose attempts are below the cap, when finding retry candidates, then it is included")
    void given_unpublished_row_below_attempts_cap_when_finding_retry_candidates_then_it_is_included() {
        Notification underCap = repository.save(NotificationFixtures.withPublishState(
                "u1", NotificationFixtures.nonPublishedAttempts(MAX_ATTEMPTS - 1)));

        List<Notification> candidates = repository.findRetryablePublishCandidates(MAX_ATTEMPTS, 100);

        assertThat(candidates).extracting(Notification::getId).contains(underCap.getId());
    }

    @Test
    @DisplayName("Given a row that was already published, when finding retry candidates, then it is excluded")
    void given_already_published_row_when_finding_retry_candidates_then_it_is_excluded() {
        Notification done = repository.save(NotificationFixtures.withPublishState(
                "u1", NotificationFixtures.published()));

        List<Notification> candidates = repository.findRetryablePublishCandidates(MAX_ATTEMPTS, 100);

        assertThat(candidates).extracting(Notification::getId).doesNotContain(done.getId());
    }

    @Test
    @DisplayName("Given rows whose attempts have reached or exceeded the cap, when finding retry candidates, then they are excluded")
    void given_rows_at_or_above_attempts_cap_when_finding_retry_candidates_then_they_are_excluded() {
        Notification atCap = repository.save(NotificationFixtures.withPublishState(
                "u1", NotificationFixtures.nonPublishedAttempts(MAX_ATTEMPTS)));
        Notification overCap = repository.save(NotificationFixtures.withPublishState(
                "u1", NotificationFixtures.nonPublishedAttempts(MAX_ATTEMPTS + 3)));

        List<Notification> candidates = repository.findRetryablePublishCandidates(MAX_ATTEMPTS, 100);

        assertThat(candidates).extracting(Notification::getId)
                .doesNotContain(atCap.getId(), overCap.getId());
    }

    @Test
    @DisplayName("Given more eligible rows than the batch size, when finding retry candidates, then no more than the batch size is returned")
    void given_more_eligible_rows_than_batch_size_when_finding_retry_candidates_then_batch_size_is_honored() {
        for (int i = 0; i < 10; i++) {
            repository.save(NotificationFixtures.withPublishState(
                    "u1", NotificationFixtures.nonPublishedAttempts(0)));
        }

        List<Notification> candidates = repository.findRetryablePublishCandidates(MAX_ATTEMPTS, 4);

        assertThat(candidates).hasSize(4);
    }

    @Test
    @DisplayName("Given a mix of fresh, under-cap, at-cap and published rows, when finding retry candidates, then only the fresh and under-cap rows are returned")
    void given_mixed_publish_states_when_finding_retry_candidates_then_only_eligible_rows_returned() {
        Notification fresh = repository.save(NotificationFixtures.basic("u1"));
        Notification underCap = repository.save(NotificationFixtures.withPublishState(
                "u2", NotificationFixtures.nonPublishedAttempts(2)));
        Notification atCap = repository.save(NotificationFixtures.withPublishState(
                "u3", NotificationFixtures.nonPublishedAttempts(MAX_ATTEMPTS)));
        Notification done = repository.save(NotificationFixtures.withPublishState(
                "u4", NotificationFixtures.published()));

        List<Notification> candidates = repository.findRetryablePublishCandidates(MAX_ATTEMPTS, 100);

        assertThat(candidates).extracting(Notification::getId)
                .containsExactlyInAnyOrder(fresh.getId(), underCap.getId())
                .doesNotContain(atCap.getId(), done.getId());
    }
}
