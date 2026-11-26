package com.openframe.data.repository.ticket;

import com.mongodb.ReadPreference;
import com.openframe.data.document.ticket.TicketAttachment;
import com.openframe.data.document.ticket.TicketAttachment.Fields;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static java.nio.charset.StandardCharsets.UTF_8;

/** Atomically inserts ticket attachment metadata while preserving an existing copy on retry. */
@RequiredArgsConstructor
public class CustomTicketAttachmentRepositoryImpl implements CustomTicketAttachmentRepository {
    private static final String DOCUMENT_ID = "_id";

    private final MongoTemplate mongoTemplate;

    @Override
    public TicketAttachment insertIfAbsent(TicketAttachment attachment) {
        String tenantId = attachment.getTenantId();
        String storagePath = attachment.getStoragePath();
        Query query = Query.query(Criteria.where(Fields.tenantId).is(tenantId)
                .and(Fields.ticketId).is(attachment.getTicketId())
                .and(Fields.storagePath).is(storagePath));
        String identity = tenantId + "/" + storagePath;
        String id = UUID.nameUUIDFromBytes(identity.getBytes(UTF_8)).toString();
        Update update = new Update()
                .setOnInsert(DOCUMENT_ID, id)
                .setOnInsert(Fields.fileName, attachment.getFileName())
                .setOnInsert(Fields.contentType, attachment.getContentType())
                .setOnInsert(Fields.fileSize, attachment.getFileSize())
                .setOnInsert(Fields.uploadedBy, attachment.getUploadedBy())
                .setOnInsert(Fields.uploadedAt, Instant.now());

        try {
            return upsertCopy(query, update);
        } catch (DuplicateKeyException exception) {
            return findConcurrentCopy(query, exception);
        }
    }

    private TicketAttachment upsertCopy(Query query, Update update) {
        FindAndModifyOptions options = FindAndModifyOptions.options().upsert(true).returnNew(true);
        return Optional.ofNullable(mongoTemplate.findAndModify(query, update, options, TicketAttachment.class))
                .orElseThrow(() -> new IllegalStateException("Ticket attachment was not saved"));
    }

    private TicketAttachment findConcurrentCopy(Query query, DuplicateKeyException exception) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            throw exception;
        }
        return Optional.ofNullable(mongoTemplate.findOne(query.withReadPreference(ReadPreference.primary()),
                        TicketAttachment.class))
                .orElseThrow(() -> exception);
    }
}
