package com.openframe.data.repository.push;

import com.openframe.data.document.push.PushDevice;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.repository.Repository;

/**
 * Bare {@link Repository} rather than {@code MongoRepository}: inherited {@code count()} is the one
 * stock method the tenant-aware template cannot scope (it passes no entity class). Nothing here needs
 * the stock CRUD, so expose none of it — every operation lives in the custom fragment.
 */
@TenantAwareRepository
public interface PushDeviceRepository extends Repository<PushDevice, String>, CustomPushDeviceRepository {
}
