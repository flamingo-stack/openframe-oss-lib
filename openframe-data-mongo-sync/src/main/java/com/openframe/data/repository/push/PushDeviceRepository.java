package com.openframe.data.repository.push;

import com.openframe.data.document.push.PushDevice;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.repository.Repository;

/** Bare {@link Repository}, not {@code MongoRepository}: the inherited {@code count()} is not tenant-scoped. */
@TenantAwareRepository
public interface PushDeviceRepository extends Repository<PushDevice, String>, CustomPushDeviceRepository {
}
