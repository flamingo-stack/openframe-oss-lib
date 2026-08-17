package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.CommandExecution;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class CustomCommandExecutionRepositoryImpl implements CustomCommandExecutionRepository {

    private static final String FIELD_ID = "_id";

    private final MongoTemplate mongoTemplate;

    @Override
    public void applyResult(CommandExecution row) {
        Update update = new Update()
                .set("status", row.getStatus())
                .set("statusChangedAt", row.getStatusChangedAt())
                .set("finishedAt", row.getFinishedAt())
                .set("exitCode", row.getExitCode())
                .set("executionTimeMs", row.getExecutionTimeMs())
                .set("timedOut", row.getTimedOut())
                .set("stdout", row.getStdout())
                .set("stdoutTruncated", row.getStdoutTruncated())
                .set("stderr", row.getStderr())
                .set("stderrTruncated", row.getStderrTruncated())
                .set("error", row.getError());
        mongoTemplate.updateFirst(new Query(Criteria.where(FIELD_ID).is(row.getId())), update, CommandExecution.class);
    }
}
