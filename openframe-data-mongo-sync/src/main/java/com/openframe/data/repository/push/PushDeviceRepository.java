package com.openframe.data.repository.push;

import com.openframe.data.document.push.PushDevice;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.mongodb.repository.MongoRepository;

@TenantAwareRepository
public interface PushDeviceRepository extends MongoRepository<PushDevice, String>, CustomPushDeviceRepository {
}
