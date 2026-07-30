package com.openframe.api.service;

import com.openframe.api.dto.knowledgebase.KnowledgeBaseImageUpload;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseImage;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseImageRepository;
import com.openframe.data.service.GcsPresignedUrlService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;

import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link KnowledgeBaseImageService}. Repository and storage are mocked;
 * these cover the validation rules, the generated storage path, and the delegation
 * contract for signed upload/download URLs.
 */
class KnowledgeBaseImageServiceTest {

    private static final long MAX_SIZE_BYTES = 10 * 1024 * 1024;
    private static final int EXPIRATION_MINUTES = 15;

    private KnowledgeBaseImageRepository repository;
    private GcsPresignedUrlService gcsPresignedUrlService;
    private KnowledgeBaseImageService service;

    @BeforeEach
    void setUp() {
        repository = mock(KnowledgeBaseImageRepository.class);
        gcsPresignedUrlService = mock(GcsPresignedUrlService.class);
        service = new KnowledgeBaseImageService(repository, gcsPresignedUrlService, MAX_SIZE_BYTES, EXPIRATION_MINUTES);
    }

    @Test
    @DisplayName("createUpload saves the image with a UUID storage path and returns a size-capped signed PUT URL")
    void createUpload_happyPath() {
        when(repository.save(any(KnowledgeBaseImage.class))).thenAnswer(invocation -> {
            KnowledgeBaseImage image = invocation.getArgument(0);
            image.setId("img-1");
            return image;
        });
        when(gcsPresignedUrlService.generateUploadUrl(any(), any(), any(), anyLong()))
                .thenReturn("https://signed-upload");

        KnowledgeBaseImageUpload upload = service.createUpload("user-1", "screenshot.png", "image/png", 1234L);

        ArgumentCaptor<KnowledgeBaseImage> imageCaptor = ArgumentCaptor.forClass(KnowledgeBaseImage.class);
        verify(repository).save(imageCaptor.capture());
        KnowledgeBaseImage saved = imageCaptor.getValue();
        assertThat(saved.getStoragePath()).matches("kb-images/[0-9a-f-]{36}\\.png");
        assertThat(saved.getFileName()).isEqualTo("screenshot.png");
        assertThat(saved.getContentType()).isEqualTo("image/png");
        assertThat(saved.getFileSize()).isEqualTo(1234L);
        assertThat(saved.getUploadedBy()).isEqualTo("user-1");

        verify(gcsPresignedUrlService).generateUploadUrl(
                eq(saved.getStoragePath()), eq("image/png"),
                eq(Duration.ofMinutes(EXPIRATION_MINUTES)), eq(MAX_SIZE_BYTES));

        assertThat(upload.getImage().getId()).isEqualTo("img-1");
        assertThat(upload.getUploadUrl()).isEqualTo("https://signed-upload");
        assertThat(upload.getContentLengthRange()).isEqualTo("0," + MAX_SIZE_BYTES);
    }

    @Test
    @DisplayName("createUpload normalizes content type casing and parameters")
    void createUpload_normalizesContentType() {
        when(repository.save(any(KnowledgeBaseImage.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(gcsPresignedUrlService.generateUploadUrl(any(), any(), any(), anyLong()))
                .thenReturn("https://signed-upload");

        service.createUpload("user-1", "photo.jpeg", "image/JPEG; charset=utf-8", 100L);

        ArgumentCaptor<KnowledgeBaseImage> imageCaptor = ArgumentCaptor.forClass(KnowledgeBaseImage.class);
        verify(repository).save(imageCaptor.capture());
        assertThat(imageCaptor.getValue().getContentType()).isEqualTo("image/jpeg");
        assertThat(imageCaptor.getValue().getStoragePath()).endsWith(".jpg");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(longs = {0L, -1L, MAX_SIZE_BYTES + 1})
    @DisplayName("createUpload rejects missing, non-positive, and oversized file sizes")
    void createUpload_rejectsInvalidSize(Long fileSize) {
        assertThatThrownBy(() -> service.createUpload("user-1", "a.png", "image/png", fileSize))
                .isInstanceOf(BadRequestException.class);

        verifyNoInteractions(repository, gcsPresignedUrlService);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"image/svg+xml", "text/plain", "application/octet-stream", "image/"})
    @DisplayName("createUpload rejects content types outside the image whitelist")
    void createUpload_rejectsUnsupportedContentType(String contentType) {
        assertThatThrownBy(() -> service.createUpload("user-1", "a.bin", contentType, 100L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Unsupported image type");

        verifyNoInteractions(repository, gcsPresignedUrlService);
    }

    @Test
    @DisplayName("generateDownloadUrl signs the stored path with the configured expiration")
    void generateDownloadUrl_happyPath() {
        when(repository.findById("img-1")).thenReturn(Optional.of(KnowledgeBaseImage.builder()
                .id("img-1")
                .storagePath("kb-images/abc.png")
                .build()));
        when(gcsPresignedUrlService.generateDownloadUrl("kb-images/abc.png", Duration.ofMinutes(EXPIRATION_MINUTES)))
                .thenReturn("https://signed-download");

        assertThat(service.generateDownloadUrl("img-1")).isEqualTo("https://signed-download");
    }

    @Test
    @DisplayName("generateDownloadUrl throws NotFoundException for an unknown image id")
    void generateDownloadUrl_unknownId() {
        when(repository.findById("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.generateDownloadUrl("missing"))
                .isInstanceOf(NotFoundException.class);

        verifyNoInteractions(gcsPresignedUrlService);
    }
}
