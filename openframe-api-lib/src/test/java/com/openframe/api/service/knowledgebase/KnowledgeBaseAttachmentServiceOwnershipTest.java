package com.openframe.api.service.knowledgebase;

import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemAttachmentRepository;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.service.GcsPresignedUrlService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class KnowledgeBaseAttachmentServiceOwnershipTest {

    private final KnowledgeBaseItemAttachmentRepository attachments = mock(KnowledgeBaseItemAttachmentRepository.class);
    private final GcsPresignedUrlService storage = mock(GcsPresignedUrlService.class);
    private final KnowledgeBaseAttachmentService service = new KnowledgeBaseAttachmentService(
            attachments, mock(KnowledgeBaseItemRepository.class), storage);

    @Test
    @DisplayName("an attachment of another article is refused, so a save cannot delete someone else's file")
    void foreignAttachmentIsRefused() {
        when(attachments.findAllById(List.of("x1", "x2")))
                .thenReturn(List.of(attachment("x1", "a1"), attachment("x2", "other-article")));

        assertThatThrownBy(() -> service.getArticleAttachments("a1", List.of("x1", "x2")))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    @DisplayName("an id that no longer exists is left out, so a repeated save passes")
    void missingAttachmentIsLeftOut() {
        KnowledgeBaseItemAttachment own = attachment("x1", "a1");
        when(attachments.findAllById(List.of("x1", "gone"))).thenReturn(List.of(own));

        assertThat(service.getArticleAttachments("a1", List.of("x1", "gone"))).containsExactly(own);
    }

    @Test
    @DisplayName("no ids, no lookup")
    void nothingToLoad() {
        assertThat(service.getArticleAttachments("a1", null)).isEmpty();
        assertThat(service.getArticleAttachments("a1", List.of())).isEmpty();
        verifyNoInteractions(attachments);
    }

    @Test
    @DisplayName("deleting removes the file and then its record")
    void deleteRemovesFileThenRecord() {
        KnowledgeBaseItemAttachment own = attachment("x1", "a1");

        service.deleteAttachments(List.of(own), Set.of());

        InOrder inOrder = inOrder(storage, attachments);
        inOrder.verify(storage).deleteFile("kb-attachments/a1/x1.pdf");
        inOrder.verify(attachments).delete(own);
    }

    @Test
    @DisplayName("a path a newer attachment took over keeps its file; only the old record goes")
    void fileStillInUseIsKept() {
        KnowledgeBaseItemAttachment replaced = attachment("x1", "a1");

        service.deleteAttachments(List.of(replaced), Set.of("kb-attachments/a1/x1.pdf"));

        verify(storage, never()).deleteFile(any());
        verify(attachments).delete(replaced);
    }

    private static KnowledgeBaseItemAttachment attachment(String id, String articleId) {
        return KnowledgeBaseItemAttachment.builder()
                .id(id)
                .itemId(articleId)
                .fileName(id + ".pdf")
                .storagePath("kb-attachments/" + articleId + "/" + id + ".pdf")
                .build();
    }
}
