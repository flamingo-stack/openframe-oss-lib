package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface OsUpdateRepository extends MongoRepository<OsUpdate, String>, CustomOsUpdateRepository {

    List<OsUpdate> findByTenantIdAndPlatformAndIdentifierIn(
            String tenantId, OsPlatform platform, Collection<String> identifiers);

    Optional<OsUpdate> findByTenantIdAndId(String tenantId, String id);

    List<OsUpdate> findByTenantIdAndIdIn(String tenantId, Collection<String> ids);

    // Never attempted first: null sorts before every date.
    @Query(value = "{ 'tenantId': ?0, $or: [ { 'enrichedAt': null }, { 'enrichedAt': { $lt: ?1 } } ] }",
            sort = "{ 'enrichmentAttemptedAt': 1 }")
    List<OsUpdate> findEnrichedBefore(String tenantId, Instant enrichedBefore, Pageable pageable);
}
