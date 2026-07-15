package com.openframe.data.repository.push;

import com.openframe.data.document.push.PushDevice;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.repository.Repository;

import java.util.List;

/** Bare {@link Repository}, not {@code MongoRepository}: inherited {@code count()} and {@code deleteAll()} are not tenant-scoped ({@code deleteAll()} would wipe every tenant's rows). */
@TenantAwareRepository
public interface PushDeviceRepository extends Repository<PushDevice, String>, CustomPushDeviceRepository {

    List<PushDevice> findByUserId(String userId);
}
