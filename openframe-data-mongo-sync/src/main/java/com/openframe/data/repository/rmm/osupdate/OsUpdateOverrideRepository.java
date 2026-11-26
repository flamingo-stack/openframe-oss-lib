package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface OsUpdateOverrideRepository extends MongoRepository<OsUpdateOverride, String> {

    List<OsUpdateOverride> findByTenantIdAndPlatformAndIdentifierIn(
            String tenantId, OsPlatform platform, Collection<String> identifiers);

    List<OsUpdateOverride> findByTenantIdAndPlatformAndIdentifier(
            String tenantId, OsPlatform platform, String identifier);

    long deleteByTenantIdAndMachineId(String tenantId, String machineId);
}
