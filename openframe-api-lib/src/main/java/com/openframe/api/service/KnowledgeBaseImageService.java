package com.openframe.api.service;

import com.openframe.api.config.KnowledgeBaseImageProperties;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseImageUpload;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseImage;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseImageRepository;
import com.openframe.data.service.GcsPresignedUrlService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

import static java.util.stream.Collectors.joining;

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
@RequiredArgsConstructor
@ConditionalOnProperty(name = "storage.s3.disabled", havingValue = "false")
public class KnowledgeBaseImageService {

    private static final String KB_IMAGES_PREFIX = "kb-images";

    private final KnowledgeBaseImageRepository imageRepository;
    private final GcsPresignedUrlService gcsPresignedUrlService;
    private final KnowledgeBaseImageProperties imageProperties;

    public KnowledgeBaseImageUpload createUpload(String uploaderId, String fileName, String contentType, Long fileSize) {
        long maxSizeBytes = imageProperties.getMaxSizeBytes();
        String extension = validateAndResolveExtension(contentType, fileSize, maxSizeBytes);

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
                Duration.ofMinutes(imageProperties.getUploadUrlExpirationMinutes()),
                maxSizeBytes);

        log.debug("Knowledge Base image upload created: id={}, path={}, by={}", image.getId(), storagePath, uploaderId);

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
                Duration.ofMinutes(getDownloadUrlExpirationMinutes()));
    }

    /** Signature lifetime the caller should keep its redirect cached just under. */
    public int getDownloadUrlExpirationMinutes() {
        return imageProperties.getDownloadUrlExpirationMinutes();
    }

    /**
     * Validates the client-declared metadata and returns the storage extension for the content
     * type. The bytes never reach this service, so this — plus the size range signed into the
     * upload URL — is the whole server-side gate.
     */
    private String validateAndResolveExtension(String contentType, Long fileSize, long maxSizeBytes) {
        if (fileSize == null || fileSize <= 0) {
            throw new BadRequestException("Image file size must be positive");
        }
        if (fileSize > maxSizeBytes) {
            throw new BadRequestException("Image exceeds maximum size of " + maxSizeBytes + " bytes");
        }
        String extension = resolveExtension(contentType);
        if (extension == null) {
            throw new BadRequestException("Unsupported image type: " + contentType
                    + ". Allowed: " + allowedContentTypes());
        }
        return extension;
    }

    /**
     * Storage extension for the given content type, or null when it is not configured as
     * allowed. Configured types are matched case-insensitively so a deployment writing
     * {@code image/JPEG} still works.
     */
    private String resolveExtension(String contentType) {
        String normalized = normalizeContentType(contentType);
        return imageProperties.getAllowedTypes().stream()
                .filter(allowed -> allowed.getContentType() != null
                        && allowed.getContentType().trim().equalsIgnoreCase(normalized))
                .map(KnowledgeBaseImageProperties.AllowedType::getExtension)
                .findFirst()
                .orElse(null);
    }

    private String allowedContentTypes() {
        return imageProperties.getAllowedTypes().stream()
                .map(KnowledgeBaseImageProperties.AllowedType::getContentType)
                .collect(joining(", "));
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
