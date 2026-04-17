package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.TempAttachment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface TempAttachmentRepository extends MongoRepository<TempAttachment, String> {

    List<TempAttachment> findByIdIn(List<String> ids);

    List<TempAttachment> findByUploadedBy(String uploadedBy);

    List<TempAttachment> findByCreatedAtBefore(Instant cutoffTime);
}
