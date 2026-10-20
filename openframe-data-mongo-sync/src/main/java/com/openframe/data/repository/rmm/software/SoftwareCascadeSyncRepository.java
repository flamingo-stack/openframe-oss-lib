package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.software.SoftwareCascadeSync;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SoftwareCascadeSyncRepository extends MongoRepository<SoftwareCascadeSync, String> {

    List<SoftwareCascadeSync> findByStatus(DeviceOnlineDispatchStatus status, Pageable pageable);
}
