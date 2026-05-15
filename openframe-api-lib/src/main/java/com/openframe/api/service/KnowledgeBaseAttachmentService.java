package com.openframe.api.service;

import com.openframe.api.dto.knowledgebase.KnowledgeBaseAttachmentUpload;
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
import java.util.stream.Collectors;

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

    public String generateDownloadUrl(String attachmentId) {
        KnowledgeBaseItemAttachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found: " + attachmentId));

        log.info("Generating download URL for Knowledge Base attachment: {}", attachmentId);

        return gcsPresignedUrlService.generateDownloadUrl(
                attachment.getStoragePath(),
                Duration.ofMinutes(presignedUrlExpirationMinutes)
        );
    }

    @Transactional
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
        log.info("Deleting Knowledge Base attachment: {}", attachmentId);

        KnowledgeBaseItemAttachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found: " + attachmentId));

        gcsPresignedUrlService.deleteFile(attachment.getStoragePath());
        attachmentRepository.delete(attachment);
        log.info("Knowledge Base Attachment deleted: {}", attachmentId);
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
