package com.openframe.management.migration;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.result.UpdateResult;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

/**
 * Removes the orphaned {@code chatType} field (and the dead single-command approval fields) from stored
 * AI-agent documents after {@code ChatType} was deleted from the model.
 * <p>
 * {@code chatType} used to discriminate the client vs admin AI chat; the code now derives that from the
 * dialog's {@code AgentType} and the field is gone from {@code Message}, {@code AiMemoryMessage} and
 * {@code ToolApprovalRequest}. The approval request also lost the pre-batch single-command fields
 * (superseded by {@code toolCalls}). Existing documents still carry these orphans; this unsets them so the
 * stored shape matches the model, and drops the stale {@code ai_memory_messages} compound index that keyed
 * on {@code chatType}. Runs per-tenant (one Mongock changelog per tenant database).
 */
@Slf4j
@ChangeUnit(id = "remove-chattype-and-dead-approval-fields", order = "008", author = "openframe")
public class RemoveChatTypeAndDeadApprovalFieldsChangeUnit {

    private static final String COLLECTION_MESSAGES = "messages";
    private static final String COLLECTION_AI_MEMORY = "ai_memory_messages";
    private static final String COLLECTION_APPROVALS = "tool_approval_requests";

    private static final String FIELD_CHAT_TYPE = "chatType";

    private static final List<String> DEAD_APPROVAL_FIELDS = List.of(
            "chatType",
            "machineIds",
            "toolType",
            "toolName",
            "command",
            "explanation",
            "toolExecutionRequestId",
            "runAsUser",
            "timeoutSeconds");

    @Execution
    public void execution(MongoTemplate mongoTemplate) {
        unsetChatType(mongoTemplate, COLLECTION_MESSAGES);
        unsetChatType(mongoTemplate, COLLECTION_AI_MEMORY);
        unsetDeadApprovalFields(mongoTemplate);
        dropStaleChatTypeIndex(mongoTemplate, COLLECTION_AI_MEMORY);
    }

    private void unsetChatType(MongoTemplate mongoTemplate, String collection) {
        Query query = new Query(Criteria.where(FIELD_CHAT_TYPE).exists(true));
        UpdateResult result = mongoTemplate.updateMulti(
                query, new Update().unset(FIELD_CHAT_TYPE), collection);
        log.info("Removed orphan '{}' from {}: matched={}, modified={}",
                FIELD_CHAT_TYPE, collection, result.getMatchedCount(), result.getModifiedCount());
    }

    private void unsetDeadApprovalFields(MongoTemplate mongoTemplate) {
        Update update = new Update();
        DEAD_APPROVAL_FIELDS.forEach(update::unset);
        UpdateResult result = mongoTemplate.updateMulti(new Query(), update, COLLECTION_APPROVALS);
        log.info("Removed dead approval fields {} from {}: matched={}, modified={}",
                DEAD_APPROVAL_FIELDS, COLLECTION_APPROVALS, result.getMatchedCount(), result.getModifiedCount());
    }

    private void dropStaleChatTypeIndex(MongoTemplate mongoTemplate, String collection) {
        if (!mongoTemplate.collectionExists(collection)) {
            return;
        }
        MongoCollection<Document> mongoCollection = mongoTemplate.getCollection(collection);
        for (Document index : mongoCollection.listIndexes()) {
            Document key = index.get("key", Document.class);
            if (key != null && key.containsKey(FIELD_CHAT_TYPE)) {
                String name = index.getString("name");
                mongoCollection.dropIndex(name);
                log.info("Dropped stale chatType index {} (key {}) on {}", name, key.toJson(), collection);
            }
        }
    }

    @RollbackExecution
    public void rollback() {
        // No rollback: chatType and the single-command approval fields were removed from the model
        // and must not be reinstated.
    }
}
