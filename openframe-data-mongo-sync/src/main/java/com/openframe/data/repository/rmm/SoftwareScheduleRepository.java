package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.script.ScriptStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface SoftwareScheduleRepository extends MongoRepository<SoftwareSchedule, String> {

    Optional<SoftwareSchedule> findByTenantIdAndId(String tenantId, String id);

    List<SoftwareSchedule> findByTenantIdAndIdIn(String tenantId, Collection<String> ids);

    Optional<SoftwareSchedule> findByTenantIdAndName(String tenantId, String name);

    boolean existsByTenantIdAndNameAndStatusIn(String tenantId, String name, Collection<ScriptStatus> statuses);

    boolean existsByTenantIdAndNameAndIdNotAndStatusIn(String tenantId, String name, String excludeId, Collection<ScriptStatus> statuses);

    List<SoftwareSchedule> findByStatusAndNextRunAtLessThanEqual(ScriptStatus status, Instant cutoff);

    List<SoftwareSchedule> findByStatusAndTriggerAndTimeReference(ScriptStatus status, ScheduleScriptTrigger trigger, ScheduleTimeReference timeReference);
}
