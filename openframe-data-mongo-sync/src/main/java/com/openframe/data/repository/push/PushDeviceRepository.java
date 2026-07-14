package com.openframe.data.repository.push;

import com.openframe.data.document.push.PushDevice;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.repository.Repository;

/**
 * Deliberately extends the bare {@link Repository} marker rather than {@code MongoRepository}.
 *
 * <p>{@code SimpleMongoRepository}'s inherited {@code count()}, {@code findAll()}, {@code findById()},
 * {@code existsById()} and {@code deleteById()} pass a collection name rather than an entity class, so
 * {@code TenantAwareMongoTemplate} cannot scope them — they would read and delete every tenant's
 * devices. {@code TenantScopedRepositoryImpl} (openframe-saas-lib) exists to fix exactly that, but no
 * production {@code @EnableMongoRepositories} sets it as {@code repositoryBaseClass} — only a test
 * does — so today those methods are unscoped. Rather than depend on that being wired, the methods are
 * simply not exposed: everything this repository needs is in the custom fragment and goes through the
 * scoped template.
 */
@TenantAwareRepository
public interface PushDeviceRepository extends Repository<PushDevice, String>, CustomPushDeviceRepository {
}
