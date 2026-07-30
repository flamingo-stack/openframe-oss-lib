package com.openframe.api.controller;

import com.openframe.api.dto.knowledgebase.KnowledgeBaseImageUploadRequest;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseImageUploadResponse;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseImageUpload;
import com.openframe.api.service.KnowledgeBaseImageService;
import com.openframe.data.service.GcsPresignedUrlService;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Inline images for markdown content (Knowledge Base articles, ticket descriptions).
 * <p>
 * The markdown embeds the permanent {@code /knowledge-base/images/{id}} URL; GET
 * redirects to a freshly signed short-lived storage URL, so the embedded link never
 * expires while image bytes stream directly from storage. Upload is likewise direct:
 * POST returns a signed PUT URL the client uploads the file to.
 */
@RestController
@RequestMapping("/knowledge-base/images")
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "storage.s3.disabled", havingValue = "false")
public class KnowledgeBaseImageController {

    private static final String IMAGE_URL_TEMPLATE = "/knowledge-base/images/%s";

    private final KnowledgeBaseImageService imageService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public KnowledgeBaseImageUploadResponse createUpload(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody KnowledgeBaseImageUploadRequest request) {
        log.info("Creating Knowledge Base image upload: file={}, size={} by user: {}",
                request.fileName(), request.fileSize(), principal.getId());

        KnowledgeBaseImageUpload upload = imageService.createUpload(
                principal.getId(), request.fileName(), request.contentType(), request.fileSize());

        return new KnowledgeBaseImageUploadResponse(
                IMAGE_URL_TEMPLATE.formatted(upload.getImage().getId()),
                upload.getUploadUrl(),
                Map.of(GcsPresignedUrlService.CONTENT_LENGTH_RANGE_HEADER, upload.getContentLengthRange()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Void> getImage(@PathVariable String id) {
        String downloadUrl = imageService.generateDownloadUrl(id);

        // Cache the redirect just under the signature lifetime so repeat renders
        // reuse it instead of re-hitting the API for a fresh signature.
        long cacheMinutes = Math.max(imageService.getPresignedUrlExpirationMinutes() - 1, 0);
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(downloadUrl))
                .cacheControl(CacheControl.maxAge(cacheMinutes, TimeUnit.MINUTES).cachePrivate())
                .build();
    }
}
