package com.openframe.api.service;

import com.openframe.api.dto.knowledgebase.KnowledgeBaseImageUpload;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseImage;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseImageRepository;
import com.openframe.data.service.GcsPresignedUrlService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

/**
 * Inline images for markdown content (Knowledge Base articles, ticket descriptions).
 * <p>
 * Unlike the attachment flow ({@link KnowledgeBaseAttachmentService}), images are uploaded
 * before the owning item exists and are referenced from markdown by a permanent URL, so
 * they get a final storage path immediately (no temp/link step) and are never moved.
 * Upload goes directly to storage via a signed PUT URL; the signed
 * {@code x-goog-content-length-range} header makes storage enforce the size cap.
 */
@Service
@Slf4j
@ConditionalOnProperty(name = "storage.s3.disabled", havingValue = "false")
public class KnowledgeBaseImageService {

    private static final String KB_IMAGES_PREFIX = "kb-images";

    /** SVG is deliberately excluded: an SVG served from storage can carry scripts (stored XSS). */
    private static final Map<String, String> EXTENSION_BY_CONTENT_TYPE = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/gif", "gif",
            "image/webp", "webp"
    );

    private final KnowledgeBaseImageRepository imageRepository;
    private final GcsPresignedUrlService gcsPresignedUrlService;
    private final long maxSizeBytes;
    private final int presignedUrlExpirationMinutes;

    public KnowledgeBaseImageService(
            KnowledgeBaseImageRepository imageRepository,
            GcsPresignedUrlService gcsPresignedUrlService,
            @Value("${openframe.kb.images.max-size-bytes:10485760}") long maxSizeBytes,
            @Value("${openframe.kb.presigned-url-expiration-minutes:15}") int presignedUrlExpirationMinutes) {
        this.imageRepository = imageRepository;
        this.gcsPresignedUrlService = gcsPresignedUrlService;
        this.maxSizeBytes = maxSizeBytes;
        this.presignedUrlExpirationMinutes = presignedUrlExpirationMinutes;
    }

    public KnowledgeBaseImageUpload createUpload(String uploaderId, String fileName, String contentType, Long fileSize) {
        if (fileSize == null || fileSize <= 0) {
            throw new BadRequestException("Image file size must be positive");
        }
        if (fileSize > maxSizeBytes) {
            throw new BadRequestException("Image exceeds maximum size of " + maxSizeBytes + " bytes");
        }
        String extension = EXTENSION_BY_CONTENT_TYPE.get(normalizeContentType(contentType));
        if (extension == null) {
            throw new BadRequestException("Unsupported image type: " + contentType
                    + ". Allowed: " + String.join(", ", EXTENSION_BY_CONTENT_TYPE.keySet()));
        }

        String storagePath = "%s/%s.%s".formatted(KB_IMAGES_PREFIX, UUID.randomUUID(), extension);

        KnowledgeBaseImage image = imageRepository.save(KnowledgeBaseImage.builder()
                .fileName(fileName)
                .storagePath(storagePath)
                .fileSize(fileSize)
                .contentType(normalizeContentType(contentType))
                .uploadedBy(uploaderId)
                .build());

        String uploadUrl = gcsPresignedUrlService.generateUploadUrl(
                storagePath,
                image.getContentType(),
                Duration.ofMinutes(presignedUrlExpirationMinutes),
                maxSizeBytes);

        log.info("Knowledge Base image upload created: id={}, path={}, by={}", image.getId(), storagePath, uploaderId);

        return KnowledgeBaseImageUpload.builder()
                .image(image)
                .uploadUrl(uploadUrl)
                .contentLengthRange(GcsPresignedUrlService.contentLengthRange(maxSizeBytes))
                .build();
    }

    public String generateDownloadUrl(String imageId) {
        KnowledgeBaseImage image = imageRepository.findById(imageId)
                .orElseThrow(() -> new NotFoundException("Image not found: " + imageId));

        return gcsPresignedUrlService.generateDownloadUrl(
                image.getStoragePath(),
                Duration.ofMinutes(presignedUrlExpirationMinutes));
    }

    public int getPresignedUrlExpirationMinutes() {
        return presignedUrlExpirationMinutes;
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null) {
            return "";
        }
        int paramsStart = contentType.indexOf(';');
        String bareType = paramsStart >= 0 ? contentType.substring(0, paramsStart) : contentType;
        return bareType.trim().toLowerCase();
    }
}
