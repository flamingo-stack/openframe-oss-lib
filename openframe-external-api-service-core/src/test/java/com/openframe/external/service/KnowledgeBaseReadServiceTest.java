package com.openframe.external.service;

import com.openframe.api.service.knowledgebase.KnowledgeBaseAttachmentService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseTagService;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemAttachmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.external.dto.knowledgebase.KnowledgeBaseAttachmentResponse;
import com.openframe.external.dto.knowledgebase.KnowledgeBaseItemResponse;
import com.openframe.external.dto.knowledgebase.KnowledgeBaseTagResponse;
import com.openframe.external.exception.KnowledgeBaseAttachmentNotFoundException;
import com.openframe.external.exception.KnowledgeBaseItemNotFoundException;
import com.openframe.external.exception.KnowledgeBaseTagNotFoundException;
import com.openframe.external.mapper.KnowledgeBaseMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseReadServiceTest {

    @Mock
    private KnowledgeBaseService knowledgeBaseService;
    @Mock
    private KnowledgeBaseTagService knowledgeBaseTagService;
    @Mock
    private KnowledgeBaseAttachmentService knowledgeBaseAttachmentService;
    @Mock
    private TagRepository tagRepository;
    @Mock
    private KnowledgeBaseItemAttachmentRepository attachmentRepository;

    private KnowledgeBaseReadService service;

    @BeforeEach
    void setUp() {
        service = new KnowledgeBaseReadService(knowledgeBaseService, knowledgeBaseTagService,
                knowledgeBaseAttachmentService, tagRepository, attachmentRepository, new KnowledgeBaseMapper());
    }

    @Test
    void requireItemReturnsTheStoredItem() {
        KnowledgeBaseItem article = article("art-1");
        when(knowledgeBaseService.getItem("art-1")).thenReturn(Optional.of(article));

        assertSame(article, service.requireItem("art-1"));
    }

    @Test
    void requireItemOfUnknownIdIsNotFound() {
        when(knowledgeBaseService.getItem("missing")).thenReturn(Optional.empty());

        KnowledgeBaseItemNotFoundException ex =
                assertThrows(KnowledgeBaseItemNotFoundException.class, () -> service.requireItem("missing"));

        assertEquals(ErrorCode.KNOWLEDGE_BASE_ITEM_NOT_FOUND, ex.getErrorCode());
        assertEquals("Knowledge base item not found: missing", ex.getMessage());
    }

    @Test
    void requireTypedItemReturnsAnItemOfThatKind() {
        KnowledgeBaseItem folder = folder("folder-1");
        when(knowledgeBaseService.getItem("folder-1")).thenReturn(Optional.of(folder));

        assertSame(folder, service.requireItem("folder-1", KnowledgeBaseItemType.FOLDER));
    }

    @Test
    void requireTypedItemOfUnknownIdIsNotFound() {
        when(knowledgeBaseService.getItem("missing")).thenReturn(Optional.empty());

        assertThrows(KnowledgeBaseItemNotFoundException.class,
                () -> service.requireItem("missing", KnowledgeBaseItemType.ARTICLE));
    }

    @Test
    void folderIdOnAnArticleRouteIsNotFound() {
        when(knowledgeBaseService.getItem("folder-1")).thenReturn(Optional.of(folder("folder-1")));

        KnowledgeBaseItemNotFoundException ex = assertThrows(KnowledgeBaseItemNotFoundException.class,
                () -> service.requireItem("folder-1", KnowledgeBaseItemType.ARTICLE));

        assertEquals("Knowledge base item not found: folder-1", ex.getMessage());
    }

    @Test
    void articleIdOnAFolderRouteIsNotFound() {
        when(knowledgeBaseService.getItem("art-1")).thenReturn(Optional.of(article("art-1")));

        assertThrows(KnowledgeBaseItemNotFoundException.class,
                () -> service.requireItem("art-1", KnowledgeBaseItemType.FOLDER));
    }

    @Test
    void requireTagReturnsAKnowledgeBaseTag() {
        Tag tag = tag("tag-1", TagEntityType.KNOWLEDGE_ARTICLE);
        when(tagRepository.findById("tag-1")).thenReturn(Optional.of(tag));

        assertSame(tag, service.requireTag("tag-1"));
    }

    @Test
    void requireTagOfUnknownIdIsNotFound() {
        when(tagRepository.findById("missing")).thenReturn(Optional.empty());

        KnowledgeBaseTagNotFoundException ex =
                assertThrows(KnowledgeBaseTagNotFoundException.class, () -> service.requireTag("missing"));

        assertEquals(ErrorCode.TAG_NOT_FOUND, ex.getErrorCode());
        assertEquals("Tag not found: missing", ex.getMessage());
    }

    @ParameterizedTest
    @EnumSource(value = TagEntityType.class, mode = EnumSource.Mode.EXCLUDE, names = "KNOWLEDGE_ARTICLE")
    void tagOfAnotherEntityTypeIsNotFound(TagEntityType entityType) {
        when(tagRepository.findById("tag-1")).thenReturn(Optional.of(tag("tag-1", entityType)));

        assertThrows(KnowledgeBaseTagNotFoundException.class, () -> service.requireTag("tag-1"));
    }

    @Test
    void tagWithoutEntityTypeIsNotFound() {
        when(tagRepository.findById("tag-1")).thenReturn(Optional.of(tag("tag-1", null)));

        assertThrows(KnowledgeBaseTagNotFoundException.class, () -> service.requireTag("tag-1"));
    }

    @Test
    void requireAttachmentReturnsTheStoredAttachment() {
        KnowledgeBaseItemAttachment attachment = attachment("att-1");
        when(attachmentRepository.findById("att-1")).thenReturn(Optional.of(attachment));

        assertSame(attachment, service.requireAttachment("att-1"));
    }

    @Test
    void requireAttachmentOfUnknownIdIsNotFound() {
        when(attachmentRepository.findById("missing")).thenReturn(Optional.empty());

        KnowledgeBaseAttachmentNotFoundException ex = assertThrows(KnowledgeBaseAttachmentNotFoundException.class,
                () -> service.requireAttachment("missing"));

        assertEquals(ErrorCode.KNOWLEDGE_BASE_ATTACHMENT_NOT_FOUND, ex.getErrorCode());
        assertEquals("Knowledge base attachment not found: missing", ex.getMessage());
    }

    @Test
    void toResponseIncludesContentTagsAndAttachments() {
        when(knowledgeBaseTagService.getTagsByItemIds(List.of("art-1")))
                .thenReturn(List.of(List.of(tag("tag-1", TagEntityType.KNOWLEDGE_ARTICLE))));
        when(knowledgeBaseAttachmentService.getAttachmentsByArticleIds(List.of("art-1")))
                .thenReturn(List.of(List.of(attachment("att-1"))));

        KnowledgeBaseItemResponse response = service.toResponse(article("art-1"));

        assertEquals("art-1", response.getId());
        assertEquals("content of art-1", response.getContent());
        assertEquals(List.of("tag-1"), tagIds(response));
        assertEquals(List.of("att-1"), attachmentIds(response));
    }

    @Test
    void toResponsesOmitsContentAndZipsBatchedRelationsByPosition() {
        List<String> ids = List.of("folder-1", "art-1", "art-2");
        when(knowledgeBaseTagService.getTagsByItemIds(ids)).thenReturn(List.of(
                List.of(),
                List.of(tag("tag-1", TagEntityType.KNOWLEDGE_ARTICLE), tag("tag-2", TagEntityType.KNOWLEDGE_ARTICLE)),
                List.of(tag("tag-3", TagEntityType.KNOWLEDGE_ARTICLE))));
        when(knowledgeBaseAttachmentService.getAttachmentsByArticleIds(ids)).thenReturn(List.of(
                List.of(),
                List.of(),
                List.of(attachment("att-1"), attachment("att-2"))));

        List<KnowledgeBaseItemResponse> responses =
                service.toResponses(List.of(folder("folder-1"), article("art-1"), article("art-2")));

        assertEquals(ids, responses.stream().map(KnowledgeBaseItemResponse::getId).toList());
        assertTrue(responses.stream().allMatch(response -> response.getContent() == null));
        assertEquals("summary of art-1", responses.get(1).getSummary());

        assertTrue(tagIds(responses.get(0)).isEmpty());
        assertTrue(attachmentIds(responses.get(0)).isEmpty());
        assertEquals(List.of("tag-1", "tag-2"), tagIds(responses.get(1)));
        assertTrue(attachmentIds(responses.get(1)).isEmpty());
        assertEquals(List.of("tag-3"), tagIds(responses.get(2)));
        assertEquals(List.of("att-1", "att-2"), attachmentIds(responses.get(2)));
    }

    @Test
    void toResponsesLooksUpRelationsOncePerPage() {
        List<String> ids = List.of("art-1", "art-2");
        when(knowledgeBaseTagService.getTagsByItemIds(ids)).thenReturn(List.of(List.of(), List.of()));
        when(knowledgeBaseAttachmentService.getAttachmentsByArticleIds(ids)).thenReturn(List.of(List.of(), List.of()));

        service.toResponses(List.of(article("art-1"), article("art-2")));

        verify(knowledgeBaseTagService).getTagsByItemIds(ids);
        verify(knowledgeBaseAttachmentService).getAttachmentsByArticleIds(ids);
    }

    @Test
    void toResponsesOfNothingIsEmptyWithoutAnyLookup() {
        assertTrue(service.toResponses(List.of()).isEmpty());

        verifyNoInteractions(knowledgeBaseTagService, knowledgeBaseAttachmentService, knowledgeBaseService,
                tagRepository, attachmentRepository);
    }

    @Test
    void toResponseOfAFolderHasNoContent() {
        when(knowledgeBaseTagService.getTagsByItemIds(List.of("folder-1"))).thenReturn(List.of(List.of()));
        when(knowledgeBaseAttachmentService.getAttachmentsByArticleIds(List.of("folder-1"))).thenReturn(List.of(List.of()));

        KnowledgeBaseItemResponse response = service.toResponse(folder("folder-1"));

        assertEquals(KnowledgeBaseItemType.FOLDER, response.getType());
        assertNull(response.getContent());
        assertTrue(response.getTags().isEmpty());
        assertTrue(response.getAttachments().isEmpty());
    }

    private static List<String> tagIds(KnowledgeBaseItemResponse response) {
        return response.getTags().stream().map(KnowledgeBaseTagResponse::getId).toList();
    }

    private static List<String> attachmentIds(KnowledgeBaseItemResponse response) {
        return response.getAttachments().stream().map(KnowledgeBaseAttachmentResponse::getId).toList();
    }

    private static KnowledgeBaseItem article(String id) {
        return KnowledgeBaseItem.builder()
                .id(id)
                .type(KnowledgeBaseItemType.ARTICLE)
                .name("Article " + id)
                .content("content of " + id)
                .summary("summary of " + id)
                .build();
    }

    private static KnowledgeBaseItem folder(String id) {
        return KnowledgeBaseItem.builder()
                .id(id)
                .type(KnowledgeBaseItemType.FOLDER)
                .name("Folder " + id)
                .build();
    }

    private static Tag tag(String id, TagEntityType entityType) {
        return Tag.builder().id(id).key("key-" + id).entityType(entityType).build();
    }

    private static KnowledgeBaseItemAttachment attachment(String id) {
        return KnowledgeBaseItemAttachment.builder().id(id).fileName(id + ".pdf").build();
    }
}
