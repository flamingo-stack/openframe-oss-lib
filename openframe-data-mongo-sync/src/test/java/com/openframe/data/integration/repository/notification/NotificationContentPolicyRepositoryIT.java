package com.openframe.data.integration.repository.notification;

import com.openframe.data.document.notification.NotificationContentPolicy;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.repository.notification.NotificationContentPolicyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The tenant policy is a singleton with no business key of its own, so the repository leans entirely
 * on the tenant filter that {@code TenantAwareMongoTemplate} adds. Two things only a real context can
 * prove: that {@code findFirstBy()} — a derived query with no predicate — is accepted by Spring Data
 * at repository-bean creation rather than blowing up at startup, and that {@code save()} drives the
 * auditing annotations, which an {@code Update}-based write never would.
 */
@SpringBootTest(classes = NotificationContentPolicyRepositoryIT.OnlyThisRepository.class)
@Tag("integration")
class NotificationContentPolicyRepositoryIT extends BaseMongoIntegrationTest {

    /**
     * Registers this repository alone. The shared IntegrationTestApplication scans the whole
     * notification package, which drags in fragments gated on tenant-isolation that this module
     * cannot satisfy — the stamping callback they need lives in saas-lib.
     */
    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EnableMongoAuditing
    @EnableMongoRepositories(
            basePackageClasses = NotificationContentPolicyRepository.class,
            includeFilters = @ComponentScan.Filter(
                    type = FilterType.ASSIGNABLE_TYPE, classes = NotificationContentPolicyRepository.class),
            considerNestedRepositories = false)
    static class OnlyThisRepository {
    }

    @Autowired private NotificationContentPolicyRepository repository;
    @Autowired private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        mongoTemplate.dropCollection(NotificationContentPolicy.class);
    }

    @Test
    @DisplayName("Given no document, when the policy is read, then empty — absence is the default, so no backfill is ever needed")
    void absent_policy_reads_empty() {
        assertThat(repository.findFirstBy()).isEmpty();
    }

    @Test
    @DisplayName("Given a saved policy, when it is read back, then the flag round-trips and the audit timestamps are populated by save()")
    void save_round_trips_and_audits() {
        NotificationContentPolicy policy = new NotificationContentPolicy();
        policy.setContentSuppressed(true);

        repository.save(policy);

        Optional<NotificationContentPolicy> stored = repository.findFirstBy();
        assertThat(stored).isPresent();
        assertThat(stored.get().isContentSuppressed()).isTrue();
        assertThat(stored.get().getId()).isNotBlank();
        // @CreatedDate / @LastModifiedDate only fire on entity writes — the reason to prefer save()
        // over a hand-rolled Update that had to set both by hand.
        assertThat(stored.get().getCreatedAt()).isNotNull();
        assertThat(stored.get().getUpdatedAt()).isNotNull();
    }

    @Test
    @DisplayName("Given an existing policy, when it is toggled and saved, then the same document is updated rather than a second one inserted")
    void toggle_updates_in_place() {
        NotificationContentPolicy policy = new NotificationContentPolicy();
        policy.setContentSuppressed(true);
        repository.save(policy);
        String id = repository.findFirstBy().orElseThrow().getId();

        NotificationContentPolicy reread = repository.findFirstBy().orElseThrow();
        reread.setContentSuppressed(false);
        repository.save(reread);

        assertThat(mongoTemplate.findAll(NotificationContentPolicy.class)).hasSize(1);
        NotificationContentPolicy after = repository.findFirstBy().orElseThrow();
        assertThat(after.getId()).isEqualTo(id);
        assertThat(after.isContentSuppressed()).isFalse();
        assertThat(after.getCreatedAt()).isNotNull();
    }
}
