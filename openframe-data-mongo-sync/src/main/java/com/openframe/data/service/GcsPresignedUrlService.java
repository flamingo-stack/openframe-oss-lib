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

    public GcsPresignedUrlService(@Value("${storage.s3.bucket}") String bucketName) {
        this.bucketName = bucketName;
        this.storage = StorageOptions.getDefaultInstance().getService();
        log.info("GcsPresignedUrlService initialized for bucket: {}", bucketName);
    }

    public String generateUploadUrl(String path, String contentType, Duration expiration) {
        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, path)
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

        log.debug("Generated upload URL for path: {}", path);
        return url;
    }

    public String generateDownloadUrl(String path, Duration expiration) {
        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, path).build();

        String url = storage.signUrl(
                blobInfo,
                expiration.toMinutes(),
                TimeUnit.MINUTES,
                Storage.SignUrlOption.httpMethod(HttpMethod.GET),
                Storage.SignUrlOption.withV4Signature()
        ).toString();

        log.debug("Generated download URL for path: {}", path);
        return url;
    }

    public void deleteFile(String path) {
        boolean deleted = storage.delete(BlobId.of(bucketName, path));
        if (deleted) {
            log.debug("File deleted: {}", path);
        } else {
            log.warn("File not found for deletion: {}", path);
        }
    }

    public void moveFile(String sourcePath, String destPath) {
        BlobId sourceId = BlobId.of(bucketName, sourcePath);
        BlobId targetId = BlobId.of(bucketName, destPath);

        Storage.CopyRequest copyRequest = Storage.CopyRequest.of(sourceId, targetId);
        storage.copy(copyRequest);
        storage.delete(sourceId);

        log.debug("File moved: {} -> {}", sourcePath, destPath);
    }
}
