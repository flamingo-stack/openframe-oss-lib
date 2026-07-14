package com.openframe.data.repository.push;

import com.openframe.data.document.push.PushDevice;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.repository.Repository;

/**
 * Deliberately extends the bare {@link Repository} marker rather than {@code MongoRepository}.
 *
 * <p>{@code SimpleMongoRepository}'s inherited {@code count()}, {@code findAll()}, {@code findById()},
 * {@code existsById()} and {@code deleteById()} pass a collection name rather than an entity class, so
 * {@code TenantAwareMongoTemplate} cannot scope them — they would return and delete every tenant's
 * devices. The platform's Layer-2 base class that fixes this does not exist yet, so the methods are
 * simply not exposed: everything this repository needs is in the custom fragment, and all of it goes
 * through the scoped template.
 */
@TenantAwareRepository
public interface PushDeviceRepository extends Repository<PushDevice, String>, CustomPushDeviceRepository {
}
