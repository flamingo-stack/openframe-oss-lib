package com.openframe.api.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Tuning for inline markdown images (Knowledge Base articles, ticket descriptions).
 * Everything has a working default, so the feature is usable with no configuration.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "openframe.kb.images")
public class KnowledgeBaseImageProperties {

    private List<AllowedType> allowedTypes = defaultAllowedTypes();

    /**
     * Hard cap on a single image. Also signed into the upload URL as
     * {@code x-goog-content-length-range}, so storage rejects an oversized body even though the
     * bytes never pass through this service.
     */
    private long maxSizeBytes = 10 * 1024 * 1024;

    /**
     * Lifetime of the signed PUT URL handed to the client. Short by design: a signed PUT is a
     * write capability, and the client uses it within seconds of receiving it.
     */
    private int uploadUrlExpirationMinutes = 15;

    /**
     * Lifetime of the signed URL a download redirect points at, and — one minute less — how long
     * the browser caches that redirect. Storage caps V4 signatures at 7 days (10080).
     */
    private int downloadUrlExpirationMinutes = 1440;

    @Getter
    @Setter
    public static class AllowedType {

        private String contentType;
        private String extension;

        static AllowedType of(String contentType, String extension) {
            AllowedType allowedType = new AllowedType();
            allowedType.setContentType(contentType);
            allowedType.setExtension(extension);
            return allowedType;
        }
    }

    private static List<AllowedType> defaultAllowedTypes() {
        return new ArrayList<>(List.of(
                AllowedType.of("image/jpeg", "jpg"),
                AllowedType.of("image/png", "png"),
                AllowedType.of("image/webp", "webp")));
    }
}
