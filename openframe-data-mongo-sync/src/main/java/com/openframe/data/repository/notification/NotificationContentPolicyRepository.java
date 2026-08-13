package com.openframe.data.repository.notification;

import com.openframe.data.document.notification.NotificationContentPolicy;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.repository.Repository;

import java.util.Optional;

/**
 * Bare {@link Repository}, not {@code MongoRepository}: inherited {@code count()} and
 * {@code deleteAll()} are not tenant-scoped ({@code deleteAll()} would wipe every tenant's rows).
 *
 * <p>The document is a tenant singleton, so the tenant filter that
 * {@code TenantAwareMongoTemplate} adds to every query is the whole business key — hence a derived
 * query with no predicate of its own.
 */
@TenantAwareRepository
public interface NotificationContentPolicyRepository extends Repository<NotificationContentPolicy, String> {

    /** Empty when the tenant has never set a policy — callers must read that as the default. */
    Optional<NotificationContentPolicy> findFirstBy();

    NotificationContentPolicy save(NotificationContentPolicy policy);
}
