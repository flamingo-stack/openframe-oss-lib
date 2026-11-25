package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.script.ScriptStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.ReadPreference;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Repository for {@link ScheduleScript} documents.
 *
 * <p>All read/write operations are explicitly tenant-scoped. List/pagination
 * lives on {@link CustomScriptScheduleRepository}, which uses MongoTemplate for
 * cursor-style paging. Mirrors {@link ScriptRepository}.
 */
@Repository
public interface ScriptScheduleRepository
        extends MongoRepository<ScheduleScript, String>, CustomScriptScheduleRepository {

    Optional<ScheduleScript> findByTenantIdAndId(String tenantId, String id);

    @ReadPreference("primary")
    Optional<ScheduleScript> findOnPrimaryByTenantIdAndId(String tenantId, String id);

    @Query("{ 'tenantId': ?0, '_id': ?1, 'status': { '$ne': ?2 }, 'selectionMode': { '$ne': ?3 } }")
    @Update(pipeline = "{ '$set': { 'updatedAt': { '$max': ['$$NOW', { '$add': ['$updatedAt', 1] }] } } }")
    long markSpecificAssignmentChange(String tenantId, String id, ScriptStatus deletedStatus, ScheduleDeviceSelectionMode criteriaMode);

    List<ScheduleScript> findByTenantIdAndIdIn(String tenantId, Collection<String> ids);

    Optional<ScheduleScript> findByTenantIdAndName(String tenantId, String name);

    boolean existsByTenantIdAndNameAndStatusIn(String tenantId, String name, Collection<ScriptStatus> statuses);

    boolean existsByTenantIdAndNameAndIdNotAndStatusIn(String tenantId, String name, String excludeId, Collection<ScriptStatus> statuses);

    List<ScheduleScript> findByStatusAndNextRunAtLessThanEqual(ScriptStatus status, Instant cutoff);

    List<ScheduleScript> findByTenantIdAndTriggerAndStatus(String tenantId, ScheduleScriptTrigger trigger, ScriptStatus status);

    List<ScheduleScript> findByStatusAndTriggerAndTimeReference(ScriptStatus status, ScheduleScriptTrigger trigger, ScheduleTimeReference timeReference);
}
