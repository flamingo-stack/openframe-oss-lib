package com.openframe.data.repository.rmm;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
@RequiredArgsConstructor
public class CustomScheduleScriptExecutionRepositoryImpl implements CustomScheduleScriptExecutionRepository {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_FINISHED_AT = "finishedAt";

    private final MongoTemplate mongoTemplate;

    @Override
    public boolean transitionIfRunning(String tenantId, String executionId,
                                       ExecutionStatus finalStatus, Instant finishedAt) {
        Query onlyIfStillRunning = Query.query(Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_EXECUTION_ID).is(executionId)
                .and(FIELD_STATUS).is(ExecutionStatus.RUNNING));
        Update transition = new Update()
                .set(FIELD_STATUS, finalStatus)
                .set(FIELD_FINISHED_AT, finishedAt);
        UpdateResult result = mongoTemplate.updateFirst(onlyIfStillRunning, transition, ScheduleScriptExecution.class);
        return result.getModifiedCount() > 0;
    }
}
