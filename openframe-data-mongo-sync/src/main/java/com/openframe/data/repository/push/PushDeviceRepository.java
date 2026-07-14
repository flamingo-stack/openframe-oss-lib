package com.openframe.data.repository.push;

import com.openframe.data.document.push.PushDevice;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.repository.Repository;

/**
 * Extends the bare {@link Repository} marker rather than {@code MongoRepository}: nothing here needs
 * the stock CRUD, and one of it is not safe to inherit. {@code SimpleMongoRepository.count()} calls
 * {@code count(Query, String)} — the overload without an entity class — which
 * {@code TenantAwareMongoTemplate} cannot scope, and the base class that fixes it
 * ({@code TenantScopedRepositoryImpl}, openframe-saas-lib) is set as {@code repositoryBaseClass} only
 * in a test. The other inherited methods do pass the entity class and are scoped, but exposing nothing
 * beats reasoning about which one is safe: every operation is in the custom fragment.
 */
@TenantAwareRepository
public interface PushDeviceRepository extends Repository<PushDevice, String>, CustomPushDeviceRepository {
}
