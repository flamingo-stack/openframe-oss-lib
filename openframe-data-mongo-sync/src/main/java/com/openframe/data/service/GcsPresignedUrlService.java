package com.openframe.data.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ImpersonatedCredentials;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.HttpMethod;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Service for generating presigned URLs using GCS SDK with ADC.
 * Uses Application Default Credentials (same as Images).
 *
 * Requires IAM role: roles/iam.serviceAccountTokenCreator
 *
 * On GKE Workload Identity a pod's ADC is the bare WI pool principal, which is
 * NOT a service account and therefore cannot sign V4 URLs (signUrl -> IAM
 * signBlob fails with "Failed to sign the provided bytes"). When
 * {@code storage.s3.signer-service-account} is set we impersonate that GSA: the
 * pod's ADC calls iamcredentials.signBlob AS the signer SA. This requires
 * roles/iam.serviceAccountTokenCreator (granted to the cluster WI principalSet on
 * the per-cluster signer GSA). Leave the property empty to keep plain ADC.
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
            @Value("${storage.s3.prefix-enabled:false}") boolean prefixEnabled,
            @Value("${storage.s3.signer-service-account:}") String signerServiceAccount) throws IOException {
        this.bucketName = bucketName;
        this.prefix = prefix;
        this.prefixEnabled = prefixEnabled;
        this.storage = buildStorage(signerServiceAccount);
        log.info("GcsPresignedUrlService initialized for bucket: {}, prefix: '{}', prefixEnabled: {}, signerSA: '{}'",
                bucketName, prefix, prefixEnabled, signerServiceAccount);
    }

    private static Storage buildStorage(String signerServiceAccount) throws IOException {
        if (signerServiceAccount == null || signerServiceAccount.isBlank()) {
            return StorageOptions.getDefaultInstance().getService();
        }
        // Impersonate the signer GSA so signUrl() can signBlob as a real service account.
        // NOTE: signBlob is rate-limited per service account; when throttled it returns a
        // MISLEADING "Permission 'iam.serviceAccounts.signBlob' denied" rather than a 429.
        // If that surfaces under concurrent load, serialize/back off presign calls -- it is
        // throttling, not a missing IAM grant.
        GoogleCredentials credentials = ImpersonatedCredentials.create(
                GoogleCredentials.getApplicationDefault(),
                signerServiceAccount,
                null,
                List.of("https://www.googleapis.com/auth/devstorage.read_write"),
                3600);
        return StorageOptions.newBuilder()
                .setCredentials(credentials)
                .build()
                .getService();
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
