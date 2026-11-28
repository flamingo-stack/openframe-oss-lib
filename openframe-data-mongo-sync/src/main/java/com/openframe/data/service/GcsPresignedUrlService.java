package com.openframe.data.service;

import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.HttpMethod;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import com.google.cloud.storage.StorageException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.net.URLEncoder;
import java.util.Map;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;
import static java.nio.charset.StandardCharsets.UTF_8;
import static java.time.ZoneOffset.UTC;

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

    public static final String CONTENT_LENGTH_RANGE_HEADER = "x-goog-content-length-range";
    public static final String CUSTOM_TIME_HEADER = "x-goog-custom-time";
    private static final String INLINE_DISPOSITION = "inline";
    private static final String ATTACHMENT_DISPOSITION = "attachment";
    private static final String RESPONSE_CONTENT_DISPOSITION = "response-content-disposition";
    private static final String RESPONSE_CONTENT_TYPE = "response-content-type";

    private final Storage storage;
    private final String bucketName;
    private final String prefix;
    private final boolean prefixEnabled;

    @Autowired
    public GcsPresignedUrlService(
            @Value("${storage.s3.bucket}") String bucketName,
            @Value("${storage.s3.prefix:}") String prefix,
            @Value("${storage.s3.prefix-enabled:false}") boolean prefixEnabled) {
        this(bucketName, prefix, prefixEnabled, StorageOptions.getDefaultInstance().getService());
    }

    GcsPresignedUrlService(String bucketName, String prefix, boolean prefixEnabled, Storage storage) {
        this.bucketName = bucketName;
        this.prefix = prefix;
        this.prefixEnabled = prefixEnabled;
        this.storage = storage;
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

    public String generateUploadUrl(String path, String contentType, Duration expiration, long maxSizeBytes) {
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
                Storage.SignUrlOption.withExtHeaders(Map.of(CONTENT_LENGTH_RANGE_HEADER, contentLengthRange(maxSizeBytes))),
                Storage.SignUrlOption.withV4Signature()
        ).toString();

        log.debug("Generated size-capped upload URL for path: {} (max {} bytes)", fullPath, maxSizeBytes);
        return url;
    }

    public static String contentLengthRange(long maxSizeBytes) {
        return "0," + maxSizeBytes;
    }

    public String generateUploadUrl(String path, Duration expiration, Map<String, String> signedHeaders) {
        BlobInfo blob = BlobInfo.newBuilder(bucketName, withPrefix(path)).build();
        return storage.signUrl(blob, expiration.toMinutes(), TimeUnit.MINUTES,
                Storage.SignUrlOption.httpMethod(HttpMethod.PUT),
                Storage.SignUrlOption.withExtHeaders(signedHeaders),
                Storage.SignUrlOption.withV4Signature()).toString();
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

    public String generateDownloadUrl(String path, Duration expiration, String fileName, String contentType) {
        return generateReadUrl(path, expiration, fileName, contentType, ATTACHMENT_DISPOSITION);
    }

    public String generatePreviewUrl(String path, Duration expiration, String fileName, String contentType) {
        return generateReadUrl(path, expiration, fileName, contentType, INLINE_DISPOSITION);
    }

    private String generateReadUrl(String path, Duration expiration, String fileName, String contentType,
                                   String disposition) {
        String encodedName = URLEncoder.encode(fileName, UTF_8).replace("+", "%20").replace("*", "%2A");
        Map<String, String> responseHeaders = Map.of(
                RESPONSE_CONTENT_DISPOSITION, disposition + "; filename*=UTF-8''" + encodedName,
                RESPONSE_CONTENT_TYPE, contentType);
        return storage.signUrl(BlobInfo.newBuilder(bucketName, withPrefix(path)).build(),
                expiration.toMinutes(), TimeUnit.MINUTES,
                Storage.SignUrlOption.httpMethod(HttpMethod.GET),
                Storage.SignUrlOption.withQueryParams(responseHeaders),
                Storage.SignUrlOption.withV4Signature()).toString();
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

    public GcsFileContent readFile(String path, long maxSizeBytes) {
        Blob blob = storage.get(BlobId.of(bucketName, withPrefix(path)));
        if (blob == null) {
            throw new IllegalArgumentException("Uploaded file not found");
        }
        if (blob.getSize() > maxSizeBytes) {
            throw new IllegalArgumentException("File exceeds the allowed size");
        }
        byte[] content = blob.getContent();
        if (content.length > maxSizeBytes) {
            throw new IllegalArgumentException("File exceeds the allowed size");
        }
        return new GcsFileContent(content, blob.getGeneration());
    }

    public boolean fileExists(String path) {
        return storage.get(BlobId.of(bucketName, withPrefix(path))) != null;
    }

    public void writeFileIfAbsent(String path, String contentType, byte[] content) {
        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, withPrefix(path)).setContentType(contentType).build();
        writeFileIfAbsent(path, content, blobInfo);
    }

    public void writeFileIfAbsent(String path, String contentType, byte[] content, Instant customTime) {
        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, withPrefix(path))
                .setContentType(contentType)
                .setCustomTimeOffsetDateTime(customTime.atOffset(UTC))
                .build();
        writeFileIfAbsent(path, content, blobInfo);
    }

    private void writeFileIfAbsent(String path, byte[] content, BlobInfo blobInfo) {
        try {
            storage.create(blobInfo, content, Storage.BlobTargetOption.doesNotExist());
        } catch (StorageException exception) {
            requireMatchingExistingFile(path, content, exception);
        }
    }

    public void copyImmutableFile(String sourcePath, String targetPath, String contentType) {
        BlobId source = BlobId.of(bucketName, withPrefix(sourcePath));
        BlobInfo target = BlobInfo.newBuilder(bucketName, withPrefix(targetPath)).setContentType(contentType).build();
        Storage.CopyRequest request = Storage.CopyRequest.newBuilder()
                .setSource(source)
                .setTarget(target, Storage.BlobTargetOption.doesNotExist())
                .build();
        storage.copy(request).getResult();
    }

    private void requireMatchingExistingFile(String path, byte[] content, StorageException exception) {
        if (exception.getCode() != 412) {
            throw exception;
        }
        if (!Arrays.equals(readFile(path, content.length).getContent(), content)) {
            throw new IllegalStateException("Immutable file already contains different bytes");
        }
    }

    public void moveFile(String sourcePath, String destPath, long sourceGeneration) {
        BlobId sourceId = BlobId.of(bucketName, withPrefix(sourcePath), sourceGeneration);
        BlobInfo target = BlobInfo.newBuilder(bucketName, withPrefix(destPath)).build();
        Storage.CopyRequest copyRequest = Storage.CopyRequest.newBuilder()
                .setSource(sourceId)
                .setSourceOptions(Storage.BlobSourceOption.generationMatch(sourceGeneration))
                .setTarget(target, Storage.BlobTargetOption.doesNotExist())
                .build();
        storage.copy(copyRequest).getResult();
        storage.delete(sourceId, Storage.BlobSourceOption.generationMatch(sourceGeneration));
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
