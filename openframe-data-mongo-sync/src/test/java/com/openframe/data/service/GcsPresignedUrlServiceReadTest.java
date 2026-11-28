package com.openframe.data.service;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.CopyWriter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Captor;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static java.nio.charset.StandardCharsets.UTF_8;
import static java.time.ZoneOffset.UTC;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

@ExtendWith(MockitoExtension.class)
class GcsPresignedUrlServiceReadTest {

    @Mock
    private Storage storage;
    @Mock
    private Blob blob;
    @Mock
    private CopyWriter copyWriter;
    @Captor
    private ArgumentCaptor<Storage.CopyRequest> copyRequestCaptor;
    @Captor
    private ArgumentCaptor<BlobInfo> blobInfoCaptor;
    @Captor
    private ArgumentCaptor<Storage.SignUrlOption[]> signOptionsCaptor;

    private GcsPresignedUrlService service;

    @BeforeEach
    void setUp() {
        service = new GcsPresignedUrlService("bucket", "tenant", true, storage);
    }

    @Test
    void readsBoundedFileFromConfiguredPrefix() {
        // setup
        byte[] content = "sample".getBytes(UTF_8);
        when(storage.get(BlobId.of("bucket", "tenant/upload/file"))).thenReturn(blob);
        when(blob.getSize()).thenReturn(6L);
        when(blob.getContent()).thenReturn(content);
        when(blob.getGeneration()).thenReturn(7L);

        // execution
        GcsFileContent result = service.readFile("upload/file", 10L);

        // verifications
        assertThat(result.getContent()).isEqualTo(content);
        assertThat(result.getGeneration()).isEqualTo(7L);
    }

    @Test
    void rejectsOversizedObjectBeforeDownloading() {
        // setup
        when(storage.get(BlobId.of("bucket", "tenant/upload/file"))).thenReturn(blob);
        when(blob.getSize()).thenReturn(11L);

        // execution
        assertThatThrownBy(() -> service.readFile("upload/file", 10L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("File exceeds the allowed size");

        // verifications
        verify(blob, never()).getContent();
    }

    @Test
    void rejectsMissingObject() {
        // setup
        when(storage.get(BlobId.of("bucket", "tenant/upload/file"))).thenReturn(null);

        // execution
        assertThatThrownBy(() -> service.readFile("upload/file", 10L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Uploaded file not found");

        // verifications
        verify(storage).get(BlobId.of("bucket", "tenant/upload/file"));
    }

    @Test
    void promotesOnlyTheVerifiedGenerationWithoutOverwritingDestination() {
        // setup
        when(storage.copy(org.mockito.ArgumentMatchers.any(Storage.CopyRequest.class))).thenReturn(copyWriter);
        when(copyWriter.getResult()).thenReturn(blob);

        // execution
        service.moveFile("upload/file", "ready/file", 7L);

        // verifications
        verify(storage).copy(copyRequestCaptor.capture());
        assertThat(copyRequestCaptor.getValue().getSource()).isEqualTo(BlobId.of("bucket", "tenant/upload/file", 7L));
        assertThat(copyRequestCaptor.getValue().getTarget().getName()).isEqualTo("tenant/ready/file");
        assertThat(copyRequestCaptor.getValue().getTargetOptions()).containsExactly(Storage.BlobTargetOption.doesNotExist());
        verify(storage).delete(BlobId.of("bucket", "tenant/upload/file", 7L), Storage.BlobSourceOption.generationMatch(7L));
    }

    @Test
    void writesPrivateOriginalWithoutReplacingExistingFile() {
        // setup
        byte[] content = "sample".getBytes(UTF_8);

        // execution
        service.writeFileIfAbsent("ready/file", "text/plain", content);

        // verifications
        verify(storage).create(blobInfoCaptor.capture(), org.mockito.ArgumentMatchers.eq(content),
                org.mockito.ArgumentMatchers.eq(Storage.BlobTargetOption.doesNotExist()));
        assertThat(blobInfoCaptor.getValue().getBlobId()).isEqualTo(BlobId.of("bucket", "tenant/ready/file"));
        assertThat(blobInfoCaptor.getValue().getContentType()).isEqualTo("text/plain");
    }

    @Test
    void generateUploadUrl_signsCustomTimeTogetherWithTheResponseHeaders() throws Exception {
        // setup
        Map<String, String> headers = Map.of("Content-Type", "text/plain", "x-goog-content-length-range", "0,10",
                "x-goog-custom-time", "2026-11-10T10:00:00Z");
        when(storage.signUrl(any(BlobInfo.class), eq(15L), eq(TimeUnit.MINUTES),
                any(Storage.SignUrlOption[].class))).thenReturn(URI.create("https://storage.example/file").toURL());

        // execution
        service.generateUploadUrl("upload/file", Duration.ofMinutes(15), headers);

        // verifications
        verify(storage).signUrl(blobInfoCaptor.capture(), eq(15L), eq(TimeUnit.MINUTES), signOptionsCaptor.capture());
        assertThat(signOptionsCaptor.getValue()).usingRecursiveFieldByFieldElementComparator()
                .contains(Storage.SignUrlOption.withExtHeaders(headers));
    }

    @Test
    void writeFileIfAbsent_verifiedDraft_keepsTheLifecycleTimestamp() {
        // setup
        byte[] content = "sample".getBytes(UTF_8);
        Instant createdAt = Instant.parse("2026-11-10T10:00:00Z");

        // execution
        service.writeFileIfAbsent("draft/file", "text/plain", content, createdAt);

        // verifications
        verify(storage).create(blobInfoCaptor.capture(), eq(content), eq(Storage.BlobTargetOption.doesNotExist()));
        assertThat(blobInfoCaptor.getValue().getCustomTimeOffsetDateTime()).isEqualTo(createdAt.atOffset(UTC));
    }

    @Test
    void copyImmutableFile_sentFile_usesNewMetadataWithoutCustomTime() {
        // setup
        when(storage.copy(any(Storage.CopyRequest.class))).thenReturn(copyWriter);

        // execution
        service.copyImmutableFile("draft/file", "ready/file", "text/plain");

        // verifications
        verify(storage).copy(copyRequestCaptor.capture());
        Storage.CopyRequest request = copyRequestCaptor.getValue();
        assertThat(request.getSource().getName()).isEqualTo("tenant/draft/file");
        assertThat(request.getTarget().getName()).isEqualTo("tenant/ready/file");
        assertThat(request.overrideInfo()).isTrue();
        assertThat(request.getTarget().getCustomTimeOffsetDateTime()).isNull();
        assertThat(request.getTargetOptions()).containsExactly(Storage.BlobTargetOption.doesNotExist());
        verify(copyWriter).getResult();
    }

    @Test
    void signsDownloadsWithSafeOriginalFileNameAndContentType() throws Exception {
        // setup
        when(storage.signUrl(any(BlobInfo.class), eq(15L), eq(java.util.concurrent.TimeUnit.MINUTES),
                any(Storage.SignUrlOption[].class))).thenReturn(java.net.URI.create("https://storage.example/file").toURL());

        // execution
        String result = service.generateDownloadUrl("ready/file", java.time.Duration.ofMinutes(15),
                "résumé report.txt", "text/plain");

        // verifications
        assertThat(result).isEqualTo("https://storage.example/file");
        verify(storage).signUrl(blobInfoCaptor.capture(), eq(15L), eq(java.util.concurrent.TimeUnit.MINUTES), signOptionsCaptor.capture());
        assertThat(blobInfoCaptor.getValue().getName()).isEqualTo("tenant/ready/file");
        assertThat(signOptionsCaptor.getValue()).usingRecursiveFieldByFieldElementComparator().contains(
                Storage.SignUrlOption.withQueryParams(java.util.Map.of(
                        "response-content-disposition", "attachment; filename*=UTF-8''r%C3%A9sum%C3%A9%20report.txt",
                        "response-content-type", "text/plain")));
    }

    @Test
    void signsPreviewsWithInlineDispositionAndExplicitContentType() throws Exception {
        // setup
        var previewUrl = URI.create("https://storage.example/preview").toURL();
        when(storage.signUrl(any(BlobInfo.class), eq(15L), eq(TimeUnit.MINUTES),
                any(Storage.SignUrlOption[].class))).thenReturn(previewUrl);

        // execution
        String result = service.generatePreviewUrl("ready/file", Duration.ofMinutes(15),
                "agent log*.csv", "text/plain; charset=utf-8");

        // verifications
        assertThat(result).isEqualTo(previewUrl.toString());
        verify(storage).signUrl(blobInfoCaptor.capture(), eq(15L), eq(TimeUnit.MINUTES),
                signOptionsCaptor.capture());
        assertThat(blobInfoCaptor.getValue().getName()).isEqualTo("tenant/ready/file");
        assertThat(signOptionsCaptor.getValue()).usingRecursiveFieldByFieldElementComparator().contains(
                Storage.SignUrlOption.withQueryParams(Map.of(
                        "response-content-disposition", "inline; filename*=UTF-8''agent%20log%2A.csv",
                        "response-content-type", "text/plain; charset=utf-8")));
    }

    @Test
    void acceptsRetryOnlyWhenImmutableBytesMatch() {
        // setup
        byte[] content = "sample".getBytes(UTF_8);
        when(storage.create(any(BlobInfo.class), eq(content), any(Storage.BlobTargetOption[].class)))
                .thenThrow(new com.google.cloud.storage.StorageException(412, "already exists"));
        when(storage.get(BlobId.of("bucket", "tenant/ready/file"))).thenReturn(blob);
        when(blob.getSize()).thenReturn(6L);
        when(blob.getContent()).thenReturn(content);

        // execution
        service.writeFileIfAbsent("ready/file", "text/plain", content);

        // verifications
        verify(blob).getContent();
    }

    @Test
    void rejectsReplacingExistingImmutableBytes() {
        // setup
        byte[] content = "sample".getBytes(UTF_8);
        when(storage.create(any(BlobInfo.class), eq(content), any(Storage.BlobTargetOption[].class)))
                .thenThrow(new com.google.cloud.storage.StorageException(412, "already exists"));
        when(storage.get(BlobId.of("bucket", "tenant/ready/file"))).thenReturn(blob);
        when(blob.getSize()).thenReturn(6L);
        when(blob.getContent()).thenReturn("edited".getBytes(UTF_8));

        // execution
        assertThatThrownBy(() -> service.writeFileIfAbsent("ready/file", "text/plain", content))
                .isInstanceOf(IllegalStateException.class).hasMessage("Immutable file already contains different bytes");

        // verifications
        verify(blob).getContent();
    }

    @Test
    void reportsMissingRecoveryObject() {
        // setup
        when(storage.get(BlobId.of("bucket", "tenant/ready/file"))).thenReturn(null);

        // execution
        boolean result = service.fileExists("ready/file");

        // verifications
        assertThat(result).isFalse();
    }
}
