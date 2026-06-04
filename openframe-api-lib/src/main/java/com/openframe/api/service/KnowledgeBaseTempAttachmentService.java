package com.openframe.api.service;

import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.document.ticket.TempAttachment;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemAttachmentRepository;
import com.openframe.data.repository.ticket.TempAttachmentRepository;
import com.openframe.data.service.GcsPresignedUrlService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Service for Knowledge Base temporary file uploads before article save.
 * Mirrors TempAttachmentService (saas-ai-agent) for Ticket.
 *
 * Flow:
 * 1. User uploads file → createUploadUrl() → TempAttachment + presigned PUT URL
 * 2. Frontend uploads directly to GCS
 * 3. User saves article → linkTempAttachmentsToArticle() moves files to permanent storage
 * 4. TempAttachment deleted, KnowledgeBaseItemAttachment created
 */
@Service
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class KnowledgeBaseTempAttachmentService {

    private static final String TEMP_PREFIX = "temp";
    private static final String KB_ATTACHMENTS_PREFIX = "kb-attachments";
    private static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";

    @Value("${openframe.kb.presigned-url-expiration-minutes:15}")
    private int presignedUrlExpirationMinutes;

    private final TempAttachmentRepository tempAttachmentRepository;
    private final KnowledgeBaseItemAttachmentRepository attachmentRepository;
    private final GcsPresignedUrlService gcsPresignedUrlService;

    @Transactional
    public TempAttachment createUploadUrl(String uploaderId, String fileName, String contentType, Long fileSize) {
        log.info("Creating Knowledge Base temp upload URL for file: {} (size: {}) by: {}", fileName, fileSize, uploaderId);

        String tempId = UUID.randomUUID().toString();
        String storagePath = buildTempPath(tempId, fileName);
        String resolvedContentType = contentType != null ? contentType : DEFAULT_CONTENT_TYPE;

        TempAttachment temp = TempAttachment.builder()
                .fileName(fileName)
                .contentType(resolvedContentType)
                .fileSize(fileSize)
                .storagePath(storagePath)
                .uploadedBy(uploaderId)
                .build();

        TempAttachment saved = tempAttachmentRepository.save(temp);
        log.debug("Knowledge Base TempAttachment created: id={}, path={}", saved.getId(), storagePath);

        return saved;
    }

    public String generateUploadUrl(TempAttachment tempAttachment) {
        return gcsPresignedUrlService.generateUploadUrl(
                tempAttachment.getStoragePath(),
                tempAttachment.getContentType(),
                Duration.ofMinutes(presignedUrlExpirationMinutes)
        );
    }

    @Transactional
    public void deleteTempAttachment(String uploaderId, String tempId) {
        log.info("Deleting Knowledge Base temp attachment: {} by: {}", tempId, uploaderId);

        TempAttachment temp = tempAttachmentRepository.findById(tempId)
                .filter(t -> t.getUploadedBy().equals(uploaderId))
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found: " + tempId));

        gcsPresignedUrlService.deleteFile(temp.getStoragePath());
        tempAttachmentRepository.delete(temp);
        log.info("Knowledge Base TempAttachment deleted: {}", tempId);
    }

    @Transactional
    public List<KnowledgeBaseItemAttachment> linkTempAttachmentsToArticle(String articleId,
                                                                          List<String> tempIds,
                                                                          String uploadedBy) {
        if (tempIds == null || tempIds.isEmpty()) {
            return List.of();
        }
        log.debug("Linking {} temp attachments to article: {} by: {}", tempIds.size(), articleId, uploadedBy);

        List<TempAttachment> temps = tempAttachmentRepository.findByIdIn(tempIds);
        if (temps.size() != tempIds.size()) {
            log.warn("Some temp attachments not found. Requested: {}, Found: {}",
                    tempIds.size(), temps.size());
        }

        List<KnowledgeBaseItemAttachment> attachments = temps.stream()
                .map(temp -> moveToArticle(articleId, temp, uploadedBy))
                .filter(Objects::nonNull)
                .toList();

        if (!attachments.isEmpty()) {
            attachmentRepository.saveAll(attachments);
        }
        log.info("Linked {} of {} attachments to article: {}", attachments.size(), temps.size(), articleId);
        return attachments;
    }

    private KnowledgeBaseItemAttachment moveToArticle(String articleId, TempAttachment temp, String uploadedBy) {
        String newPath = buildAttachmentPath(articleId, temp.getFileName());

        try {
            gcsPresignedUrlService.moveFile(temp.getStoragePath(), newPath);
            tempAttachmentRepository.delete(temp);
            log.debug("Temp file moved: {} -> {}", temp.getStoragePath(), newPath);

            return KnowledgeBaseItemAttachment.builder()
                    .itemId(articleId)
                    .fileName(temp.getFileName())
                    .contentType(temp.getContentType())
                    .fileSize(temp.getFileSize())
                    .storagePath(newPath)
                    .uploadedBy(uploadedBy)
                    .build();
        } catch (Exception e) {
            log.error("Failed to move temp file to article: {}", temp.getId(), e);
            return null;
        }
    }

    private String buildTempPath(String tempId, String fileName) {
        return "%s/%s/%s".formatted(TEMP_PREFIX, tempId, fileName);
    }

    private String buildAttachmentPath(String articleId, String fileName) {
        return "%s/%s/%s".formatted(KB_ATTACHMENTS_PREFIX, articleId, fileName);
    }
}
