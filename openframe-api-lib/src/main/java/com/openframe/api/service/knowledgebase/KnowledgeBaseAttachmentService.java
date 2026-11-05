package com.openframe.api.service.knowledgebase;

import com.openframe.api.dto.knowledgebase.KnowledgeBaseAttachmentUpload;
import com.openframe.audit.Audited;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemAttachmentRepository;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.service.GcsPresignedUrlService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static com.openframe.data.document.audit.AuditAction.KB_ATTACHMENT_ADD;
import static com.openframe.data.document.audit.AuditAction.KB_ATTACHMENT_DELETE;
import static com.openframe.data.document.audit.AuditAction.KB_ATTACHMENT_DOWNLOAD;

/**
 * Service for Knowledge Base attachments.
 * Provides batch loading for DataLoader and presigned URL operations.
 * Mirrors TicketAttachmentService (saas-ai-agent) for Ticket.
 */
@Service
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class KnowledgeBaseAttachmentService {

    private static final String KB_ATTACHMENTS_PREFIX = "kb-attachments";
    private static final String DEFAULT_CONTENT_TYPE = "application/octet-stream";

    @Value("${openframe.kb.presigned-url-expiration-minutes:15}")
    private int presignedUrlExpirationMinutes;

    private final KnowledgeBaseItemAttachmentRepository attachmentRepository;
    private final KnowledgeBaseItemRepository articleRepository;
    private final GcsPresignedUrlService gcsPresignedUrlService;

    public List<List<KnowledgeBaseItemAttachment>> getAttachmentsByArticleIds(List<String> articleIds) {
        log.debug("Batch loading attachments for {} articles", articleIds.size());

        List<KnowledgeBaseItemAttachment> attachments = attachmentRepository.findByItemIdIn(articleIds);

        Map<String, List<KnowledgeBaseItemAttachment>> attachmentsByArticleId = attachments.stream()
                .collect(Collectors.groupingBy(KnowledgeBaseItemAttachment::getItemId));

        return articleIds.stream()
                .map(articleId -> attachmentsByArticleId.getOrDefault(articleId, List.of()))
                .toList();
    }

    public KnowledgeBaseItemAttachment getAttachment(String attachmentId) {
        return attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found: " + attachmentId));
    }

    public String generateDownloadUrl(String attachmentId) {
        return generateDownloadUrl(getAttachment(attachmentId));
    }

    @Audited(action = KB_ATTACHMENT_DOWNLOAD, targetId = "#attachment.itemId",
            details = {"attachmentId=#attachment.id", "fileName=#attachment.fileName"})
    public String generateDownloadUrl(KnowledgeBaseItemAttachment attachment) {
        log.info("Generating download URL for Knowledge Base attachment: {}", attachment.getId());

        return gcsPresignedUrlService.generateDownloadUrl(
                attachment.getStoragePath(),
                Duration.ofMinutes(presignedUrlExpirationMinutes)
        );
    }

    @Transactional
    @Audited(action = KB_ATTACHMENT_ADD, targetId = "#articleId",
            details = {"fileName=#fileName", "attachmentId=#result.attachment?.id"})
    public KnowledgeBaseAttachmentUpload createUploadUrl(String uploaderId,
                                                         String articleId,
                                                         String fileName,
                                                         String contentType,
                                                         Long fileSize) {
        validateArticleExists(articleId);

        log.info("Creating upload URL for Knowledge Base article: {}, file: {} (size: {}) by: {}",
                articleId, fileName, fileSize, uploaderId);

        String storagePath = buildAttachmentPath(articleId, fileName);
        String resolvedContentType = contentType != null ? contentType : DEFAULT_CONTENT_TYPE;

        KnowledgeBaseItemAttachment attachment = KnowledgeBaseItemAttachment.builder()
                .itemId(articleId)
                .fileName(fileName)
                .contentType(resolvedContentType)
                .fileSize(fileSize)
                .storagePath(storagePath)
                .uploadedBy(uploaderId)
                .build();

        KnowledgeBaseItemAttachment saved = attachmentRepository.save(attachment);

        String uploadUrl = gcsPresignedUrlService.generateUploadUrl(
                storagePath,
                resolvedContentType,
                Duration.ofMinutes(presignedUrlExpirationMinutes)
        );

        log.debug("Knowledge Base Attachment created: id={}, path={}", saved.getId(), storagePath);

        return KnowledgeBaseAttachmentUpload.builder()
                .attachment(saved)
                .uploadUrl(uploadUrl)
                .build();
    }

    @Transactional
    public void deleteAttachment(String attachmentId) {
        deleteAttachment(getAttachment(attachmentId));
    }

    @Transactional
    @Audited(action = KB_ATTACHMENT_DELETE, targetId = "#attachment.itemId",
            details = {"attachmentId=#attachment.id", "fileName=#attachment.fileName"})
    public void deleteAttachment(KnowledgeBaseItemAttachment attachment) {
        log.info("Deleting Knowledge Base attachment: {}", attachment.getId());
        gcsPresignedUrlService.deleteFile(attachment.getStoragePath());
        attachmentRepository.delete(attachment);
        log.info("Knowledge Base Attachment deleted: {}", attachment.getId());
    }

    /**
     * The attachments with these ids, every one of which must belong to the article — a save must
     * not be able to delete another article's files. Ids that no longer exist are left out, so a
     * save repeated after a partial failure passes.
     */
    public List<KnowledgeBaseItemAttachment> getArticleAttachments(String articleId, List<String> attachmentIds) {
        if (attachmentIds == null || attachmentIds.isEmpty()) {
            return List.of();
        }
        List<KnowledgeBaseItemAttachment> attachments = attachmentRepository.findAllById(attachmentIds);
        for (KnowledgeBaseItemAttachment attachment : attachments) {
            if (!articleId.equals(attachment.getItemId())) {
                throw new ValidationException(
                        "Attachment " + attachment.getId() + " does not belong to article " + articleId);
            }
        }
        return attachments;
    }

    /**
     * Deletes each file and then its record — the order {@link #deleteAttachment} uses.
     *
     * A file is stored under the article id and its name, so an attachment replaced by one of the
     * same name shares its path with the replacement. {@code pathsStillInUse} names such paths:
     * for them only the old record goes, the file now belongs to the new attachment.
     */
    @Transactional
    public void deleteAttachments(List<KnowledgeBaseItemAttachment> attachments, Set<String> pathsStillInUse) {
        for (KnowledgeBaseItemAttachment attachment : attachments) {
            if (!pathsStillInUse.contains(attachment.getStoragePath())) {
                gcsPresignedUrlService.deleteFile(attachment.getStoragePath());
            }
            attachmentRepository.delete(attachment);
            log.info("Knowledge Base Attachment deleted: {}", attachment.getId());
        }
    }

    private void validateArticleExists(String articleId) {
        if (!articleRepository.existsById(articleId)) {
            throw new IllegalArgumentException("Article not found: " + articleId);
        }
    }

    private String buildAttachmentPath(String articleId, String fileName) {
        return "%s/%s/%s".formatted(KB_ATTACHMENTS_PREFIX, articleId, fileName);
    }
}
