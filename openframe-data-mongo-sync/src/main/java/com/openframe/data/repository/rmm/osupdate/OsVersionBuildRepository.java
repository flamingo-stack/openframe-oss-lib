package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsVersionBuild;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OsVersionBuildRepository extends MongoRepository<OsVersionBuild, String> {

    // Bounded: one entry per OS version the vendor's bulletins name.
    List<OsVersionBuild> findByTenantIdAndPlatform(String tenantId, OsPlatform platform);
}
