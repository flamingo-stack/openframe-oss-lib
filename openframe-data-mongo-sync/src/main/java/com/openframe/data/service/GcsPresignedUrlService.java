package com.openframe.data.service;

import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.HttpMethod;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * Service for generating presigned URLs using GCS SDK with ADC.
 * Uses Application Default Credentials (same as Images).
 *
 * Requires IAM role: roles/iam.serviceAccountTokenCreator
 */
@Service
@Slf4j
@ConditionalOnProperty(name = "storage.s3.disabled", havingValue = "false")
public class GcsPresignedUrlService {

    private final Storage storage;
    private final String bucketName;
    private final String prefix;
    private final boolean prefixEnabled;

    public GcsPresignedUrlService(
            @Value("${storage.s3.bucket}") String bucketName,
            @Value("${storage.s3.prefix:}") String prefix,
            @Value("${storage.s3.prefix-enabled:false}") boolean prefixEnabled) {
        this.bucketName = bucketName;
        this.prefix = prefix;
        this.prefixEnabled = prefixEnabled;
        this.storage = StorageOptions.getDefaultInstance().getService();
        log.info("GcsPresignedUrlService initialized for bucket: {}, prefix: '{}', prefixEnabled: {}",
                bucketName, prefix, prefixEnabled);
    }

    public String generateUploadUrl(String path, String contentType, Duration expiration) {
        String fullPath = withPrefix(path);
        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, fullPath)
                .setContentType(contentType)
                .build();

        String url = storage.signUrl(
                blobInfo,
                expiration.toMinutes(),
                TimeUnit.MINUTES,
                Storage.SignUrlOption.httpMethod(HttpMethod.PUT),
                Storage.SignUrlOption.withContentType(),
                Storage.SignUrlOption.withV4Signature()
        ).toString();

        log.debug("Generated upload URL for path: {}", fullPath);
        return url;
    }

    public String generateDownloadUrl(String path, Duration expiration) {
        String fullPath = withPrefix(path);
        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, fullPath).build();

        String url = storage.signUrl(
                blobInfo,
                expiration.toMinutes(),
                TimeUnit.MINUTES,
                Storage.SignUrlOption.httpMethod(HttpMethod.GET),
                Storage.SignUrlOption.withV4Signature()
        ).toString();

        log.debug("Generated download URL for path: {}", fullPath);
        return url;
    }

    public void deleteFile(String path) {
        String fullPath = withPrefix(path);
        boolean deleted = storage.delete(BlobId.of(bucketName, fullPath));
        if (deleted) {
            log.debug("File deleted: {}", fullPath);
        } else {
            log.warn("File not found for deletion: {}", fullPath);
        }
    }

    public void moveFile(String sourcePath, String destPath) {
        BlobId sourceId = BlobId.of(bucketName, withPrefix(sourcePath));
        BlobId targetId = BlobId.of(bucketName, withPrefix(destPath));

        Storage.CopyRequest copyRequest = Storage.CopyRequest.of(sourceId, targetId);
        storage.copy(copyRequest);
        storage.delete(sourceId);

        log.debug("File moved: {} -> {}", sourceId.getName(), targetId.getName());
    }

    private String withPrefix(String path) {
        if (!prefixEnabled || prefix == null || prefix.isBlank()) {
            return path;
        }
        return prefix + "/" + path;
    }
}
