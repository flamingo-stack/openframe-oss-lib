package com.openframe.external.controller;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.knowledgebase.CreateArticleCommand;
import com.openframe.api.dto.knowledgebase.FolderChildrenAction;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseAttachmentUpload;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.knowledgebase.UpdateArticleCommand;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.service.knowledgebase.KnowledgeBaseAttachmentService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseTagService;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
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
import com.openframe.external.security.ApiKeyPrincipalResolver;
import com.openframe.external.service.KnowledgeBaseReadService;
import com.openframe.external.support.ExternalApiMockMvc;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseControllerTest {

    private static final String BASE = "/api/v1/knowledge-base";
    private static final String OWNER_ID = "owner-7";

    @Mock
    private KnowledgeBaseService knowledgeBaseService;
    @Mock
    private KnowledgeBaseTagService knowledgeBaseTagService;
    @Mock
    private KnowledgeBaseAttachmentService knowledgeBaseAttachmentService;
    @Mock
    private KnowledgeBaseReadService knowledgeBaseReadService;
    @Mock
    private ApiKeyPrincipalResolver principalResolver;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = ExternalApiMockMvc.standalone(new KnowledgeBaseController(
                knowledgeBaseService, knowledgeBaseTagService, knowledgeBaseAttachmentService,
                knowledgeBaseReadService, new KnowledgeBaseMapper(), principalResolver));
    }

    @Test
    void unknownItemIs404WithResourceErrorCode() throws Exception {
        when(knowledgeBaseReadService.requireItem("missing")).thenThrow(new KnowledgeBaseItemNotFoundException("missing"));

        mockMvc.perform(get(BASE + "/items/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ITEM_NOT_FOUND"));
    }

    @Test
    void limitAboveMaxIs400AndNeverReachesTheDomain() throws Exception {
        mockMvc.perform(get(BASE + "/items").param("limit", "101"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(knowledgeBaseService);
    }

    // ---------------------------------------------------------------- items

    @Test
    void getItemsPassesQueryParamsAsFilterSearchAndDecodedCursor() throws Exception {
        List<KnowledgeBaseItem> items = List.of(folder("folder-2"), article("art-1"));
        CountedGenericQueryResult<KnowledgeBaseItem> result = page(items, "next-raw", 7);
        when(knowledgeBaseService.queryItems(any(), eq("vpn"), any())).thenReturn(result);
        when(knowledgeBaseReadService.toResponses(items)).thenReturn(List.of(
                response("folder-2", KnowledgeBaseItemType.FOLDER), response("art-1", KnowledgeBaseItemType.ARTICLE)));

        mockMvc.perform(get(BASE + "/items")
                        .param("parentId", "folder-1")
                        .param("type", "ARTICLE")
                        .param("statuses", "DRAFT", "PUBLISHED")
                        .param("tagIds", "tag-1", "tag-2")
                        .param("search", "vpn")
                        .param("limit", "50")
                        .param("cursor", CursorCodec.encode("raw-cursor")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].id").value("folder-2"))
                .andExpect(jsonPath("$.items[0].type").value("FOLDER"))
                .andExpect(jsonPath("$.items[1].id").value("art-1"))
                .andExpect(jsonPath("$.pageInfo.hasNextPage").value(true))
                .andExpect(jsonPath("$.pageInfo.endCursor").value("next-raw"))
                .andExpect(jsonPath("$.filteredCount").value(7));

        ArgumentCaptor<KnowledgeBaseFilterCriteria> filter = ArgumentCaptor.forClass(KnowledgeBaseFilterCriteria.class);
        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        verify(knowledgeBaseService).queryItems(filter.capture(), eq("vpn"), pagination.capture());
        assertEquals("folder-1", filter.getValue().getParentId());
        assertEquals(KnowledgeBaseItemType.ARTICLE, filter.getValue().getType());
        assertEquals(List.of(KnowledgeBaseArticleStatus.DRAFT, KnowledgeBaseArticleStatus.PUBLISHED), filter.getValue().getStatuses());
        assertEquals(List.of("tag-1", "tag-2"), filter.getValue().getTagIds());
        assertEquals("raw-cursor", pagination.getValue().getCursor());
        assertEquals(50, pagination.getValue().getLimit());
        assertFalse(pagination.getValue().isBackward());
    }

    @Test
    void getItemsWithoutParamsListsTheRootFirstPageOfTwenty() throws Exception {
        when(knowledgeBaseService.queryItems(any(), isNull(), any())).thenReturn(page(List.of(), null, 0));
        when(knowledgeBaseReadService.toResponses(List.of())).thenReturn(List.of());

        mockMvc.perform(get(BASE + "/items"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.pageInfo.hasNextPage").value(false))
                .andExpect(jsonPath("$.filteredCount").value(0));

        ArgumentCaptor<KnowledgeBaseFilterCriteria> filter = ArgumentCaptor.forClass(KnowledgeBaseFilterCriteria.class);
        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        verify(knowledgeBaseService).queryItems(filter.capture(), isNull(), pagination.capture());
        assertNull(filter.getValue().getParentId());
        assertNull(filter.getValue().getType());
        assertNull(filter.getValue().getStatuses());
        assertNull(filter.getValue().getTagIds());
        assertNull(pagination.getValue().getCursor());
        assertEquals(20, pagination.getValue().getLimit());
    }

    @Test
    void getItemsCommaSeparatedListParamsAreSplit() throws Exception {
        when(knowledgeBaseService.queryItems(any(), isNull(), any())).thenReturn(page(List.of(), null, 0));
        when(knowledgeBaseReadService.toResponses(List.of())).thenReturn(List.of());

        mockMvc.perform(get(BASE + "/items").param("tagIds", "tag-1,tag-2").param("statuses", "DRAFT,PUBLISHED"))
                .andExpect(status().isOk());

        ArgumentCaptor<KnowledgeBaseFilterCriteria> filter = ArgumentCaptor.forClass(KnowledgeBaseFilterCriteria.class);
        verify(knowledgeBaseService).queryItems(filter.capture(), isNull(), any());
        assertEquals(List.of("tag-1", "tag-2"), filter.getValue().getTagIds());
        assertEquals(List.of(KnowledgeBaseArticleStatus.DRAFT, KnowledgeBaseArticleStatus.PUBLISHED), filter.getValue().getStatuses());
    }

    @Test
    void getItemsBlankCursorMeansFirstPage() throws Exception {
        when(knowledgeBaseService.queryItems(any(), isNull(), any())).thenReturn(page(List.of(), null, 0));
        when(knowledgeBaseReadService.toResponses(List.of())).thenReturn(List.of());

        mockMvc.perform(get(BASE + "/items").param("cursor", " "))
                .andExpect(status().isOk());

        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        verify(knowledgeBaseService).queryItems(any(), isNull(), pagination.capture());
        assertNull(pagination.getValue().getCursor());
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "101"})
    void getItemsLimitOutOfRangeIs400(String limit) throws Exception {
        mockMvc.perform(get(BASE + "/items").param("limit", limit))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(knowledgeBaseService, knowledgeBaseReadService);
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 100})
    void getItemsLimitBoundsAreAccepted(int limit) throws Exception {
        when(knowledgeBaseService.queryItems(any(), isNull(), any())).thenReturn(page(List.of(), null, 0));
        when(knowledgeBaseReadService.toResponses(List.of())).thenReturn(List.of());

        mockMvc.perform(get(BASE + "/items").param("limit", String.valueOf(limit)))
                .andExpect(status().isOk());

        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        verify(knowledgeBaseService).queryItems(any(), isNull(), pagination.capture());
        assertEquals(limit, pagination.getValue().getLimit());
    }

    @Test
    void getItemsNonNumericLimitIs400() throws Exception {
        mockMvc.perform(get(BASE + "/items").param("limit", "many"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void getItemsUnreadableCursorIs400AndNeverReachesTheDomain() throws Exception {
        mockMvc.perform(get(BASE + "/items").param("cursor", "not base64!"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Invalid cursor: not base64!"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void getItemsUnknownTypeIs400() throws Exception {
        mockMvc.perform(get(BASE + "/items").param("type", "NOTE"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"))
                .andExpect(jsonPath("$.message").value("Invalid value 'NOTE' for parameter 'type'"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void getItemsUnknownStatusIs400() throws Exception {
        mockMvc.perform(get(BASE + "/items").param("statuses", "DRAFT", "DELETED"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void getItemsOmitsArticleContentWhileASingleReadIncludesIt() throws Exception {
        MockMvc realReads = mockMvcWithRealReadService();
        KnowledgeBaseItem article = article("art-1");
        when(knowledgeBaseService.queryItems(any(), isNull(), any())).thenReturn(page(List.of(article), null, 1));
        when(knowledgeBaseService.getItem("art-1")).thenReturn(Optional.of(article));
        when(knowledgeBaseTagService.getTagsByItemIds(List.of("art-1"))).thenReturn(List.of(List.of(tag("tag-1", "vpn"))));
        when(knowledgeBaseAttachmentService.getAttachmentsByArticleIds(List.of("art-1")))
                .thenReturn(List.of(List.of(attachment("att-1", "art-1"))));

        realReads.perform(get(BASE + "/items"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value("art-1"))
                .andExpect(jsonPath("$.items[0].summary").value("summary of art-1"))
                .andExpect(jsonPath("$.items[0].content").value(nullValue()))
                .andExpect(jsonPath("$.items[0].tags[*].id", contains("tag-1")))
                .andExpect(jsonPath("$.items[0].attachments[*].id", contains("att-1")));

        realReads.perform(get(BASE + "/items/art-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("content of art-1"))
                .andExpect(jsonPath("$.tags[*].id", contains("tag-1")))
                .andExpect(jsonPath("$.attachments[*].id", contains("att-1")));
    }

    @Test
    void getItemReturnsTheFullItemWithTimestampsTruncatedToMillis() throws Exception {
        KnowledgeBaseItem article = article("art-1");
        when(knowledgeBaseReadService.requireItem("art-1")).thenReturn(article);
        when(knowledgeBaseReadService.toResponse(article)).thenReturn(KnowledgeBaseItemResponse.builder()
                .id("art-1")
                .type(KnowledgeBaseItemType.ARTICLE)
                .name("VPN setup")
                .parentId("folder-1")
                .slug("vpn-setup")
                .sortOrder(2)
                .content("# Steps")
                .summary("How to")
                .status(KnowledgeBaseArticleStatus.PUBLISHED)
                .publishedAt(Instant.parse("2026-01-12T10:45:00.123456789Z"))
                .createdBy("user-a")
                .lastModifiedBy("user-b")
                .createdAt(Instant.parse("2026-01-10T08:00:00.000Z"))
                .updatedAt(Instant.parse("2026-01-11T09:30:00.5Z"))
                .tags(List.of(KnowledgeBaseTagResponse.builder().id("tag-1").key("vpn").color("#00ff00").build()))
                .attachments(List.of(KnowledgeBaseAttachmentResponse.builder()
                        .id("att-1").itemId("art-1").fileName("guide.pdf").contentType("application/pdf").fileSize(2048L).build()))
                .build());

        mockMvc.perform(get(BASE + "/items/art-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("art-1"))
                .andExpect(jsonPath("$.type").value("ARTICLE"))
                .andExpect(jsonPath("$.name").value("VPN setup"))
                .andExpect(jsonPath("$.parentId").value("folder-1"))
                .andExpect(jsonPath("$.slug").value("vpn-setup"))
                .andExpect(jsonPath("$.sortOrder").value(2))
                .andExpect(jsonPath("$.content").value("# Steps"))
                .andExpect(jsonPath("$.summary").value("How to"))
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.publishedAt").value("2026-01-12T10:45:00.123Z"))
                .andExpect(jsonPath("$.createdBy").value("user-a"))
                .andExpect(jsonPath("$.lastModifiedBy").value("user-b"))
                .andExpect(jsonPath("$.createdAt").value("2026-01-10T08:00:00.000Z"))
                .andExpect(jsonPath("$.updatedAt").value("2026-01-11T09:30:00.500Z"))
                .andExpect(jsonPath("$.tags[0].id").value("tag-1"))
                .andExpect(jsonPath("$.tags[0].key").value("vpn"))
                .andExpect(jsonPath("$.tags[0].color").value("#00ff00"))
                .andExpect(jsonPath("$.attachments[0].id").value("att-1"))
                .andExpect(jsonPath("$.attachments[0].itemId").value("art-1"))
                .andExpect(jsonPath("$.attachments[0].fileName").value("guide.pdf"))
                .andExpect(jsonPath("$.attachments[0].contentType").value("application/pdf"))
                .andExpect(jsonPath("$.attachments[0].fileSize").value(2048));
    }

    @Test
    void moveItemReparentsAndReturnsTheMovedItem() throws Exception {
        KnowledgeBaseItem moved = article("art-1");
        when(knowledgeBaseService.moveToFolder("art-1", "folder-2")).thenReturn(moved);
        when(knowledgeBaseReadService.toResponse(moved)).thenReturn(
                KnowledgeBaseItemResponse.builder().id("art-1").parentId("folder-2").build());

        mockMvc.perform(json(post(BASE + "/items/art-1/move"), Map.of("parentId", "folder-2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("art-1"))
                .andExpect(jsonPath("$.parentId").value("folder-2"));

        InOrder order = inOrder(knowledgeBaseReadService, knowledgeBaseService);
        order.verify(knowledgeBaseReadService).requireItem("art-1");
        order.verify(knowledgeBaseService).moveToFolder("art-1", "folder-2");
    }

    @Test
    void moveItemWithoutParentIdMovesToTheRoot() throws Exception {
        KnowledgeBaseItem moved = article("art-1");
        when(knowledgeBaseService.moveToFolder("art-1", null)).thenReturn(moved);
        when(knowledgeBaseReadService.toResponse(moved)).thenReturn(response("art-1", KnowledgeBaseItemType.ARTICLE));

        mockMvc.perform(json(post(BASE + "/items/art-1/move"), Map.of()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("art-1"));

        verify(knowledgeBaseService).moveToFolder("art-1", null);
    }

    @Test
    void moveUnknownItemIs404AndNothingIsMoved() throws Exception {
        when(knowledgeBaseReadService.requireItem("missing")).thenThrow(new KnowledgeBaseItemNotFoundException("missing"));

        mockMvc.perform(json(post(BASE + "/items/missing/move"), Map.of("parentId", "folder-2")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ITEM_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Knowledge base item not found: missing"));

        verify(knowledgeBaseService, never()).moveToFolder(anyString(), any());
    }

    @Test
    void moveRejectedByTheDomainIs400WithItsMessage() throws Exception {
        when(knowledgeBaseService.moveToFolder("folder-1", "folder-1"))
                .thenThrow(new IllegalArgumentException("Cannot move item to itself."));

        mockMvc.perform(json(post(BASE + "/items/folder-1/move"), Map.of("parentId", "folder-1")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Cannot move item to itself."));
    }

    @Test
    void moveItemWithoutBodyIs400() throws Exception {
        mockMvc.perform(post(BASE + "/items/art-1/move").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Malformed request body"));

        verifyNoInteractions(knowledgeBaseService, knowledgeBaseReadService);
    }

    @Test
    void addTagChecksItemAndTagThenReturnsTheRefreshedItem() throws Exception {
        KnowledgeBaseItem article = article("art-1");
        when(knowledgeBaseReadService.requireItem("art-1")).thenReturn(article);
        when(knowledgeBaseReadService.toResponse(article)).thenReturn(KnowledgeBaseItemResponse.builder()
                .id("art-1")
                .tags(List.of(KnowledgeBaseTagResponse.builder().id("tag-1").key("vpn").build()))
                .build());

        mockMvc.perform(post(BASE + "/items/art-1/tags/tag-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("art-1"))
                .andExpect(jsonPath("$.tags[0].id").value("tag-1"));

        InOrder order = inOrder(knowledgeBaseReadService, knowledgeBaseTagService);
        order.verify(knowledgeBaseReadService).requireItem("art-1");
        order.verify(knowledgeBaseReadService).requireTag("tag-1");
        order.verify(knowledgeBaseTagService).addTagToItem("art-1", "tag-1");
        order.verify(knowledgeBaseReadService).requireItem("art-1");
        order.verify(knowledgeBaseReadService).toResponse(article);
    }

    @Test
    void addUnknownTagIs404AndNothingIsTagged() throws Exception {
        when(knowledgeBaseReadService.requireTag("missing")).thenThrow(new KnowledgeBaseTagNotFoundException("missing"));

        mockMvc.perform(post(BASE + "/items/art-1/tags/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TAG_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Tag not found: missing"));

        verifyNoInteractions(knowledgeBaseTagService);
    }

    @Test
    void addTagToUnknownItemIs404AndNothingIsTagged() throws Exception {
        when(knowledgeBaseReadService.requireItem("missing")).thenThrow(new KnowledgeBaseItemNotFoundException("missing"));

        mockMvc.perform(post(BASE + "/items/missing/tags/tag-1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ITEM_NOT_FOUND"));

        verify(knowledgeBaseReadService, never()).requireTag(anyString());
        verifyNoInteractions(knowledgeBaseTagService);
    }

    @Test
    void removeTagReturnsTheRefreshedItem() throws Exception {
        KnowledgeBaseItem article = article("art-1");
        when(knowledgeBaseReadService.requireItem("art-1")).thenReturn(article);
        when(knowledgeBaseReadService.toResponse(article)).thenReturn(
                KnowledgeBaseItemResponse.builder().id("art-1").tags(List.of()).build());

        mockMvc.perform(delete(BASE + "/items/art-1/tags/tag-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("art-1"))
                .andExpect(jsonPath("$.tags", hasSize(0)));

        InOrder order = inOrder(knowledgeBaseReadService, knowledgeBaseTagService);
        order.verify(knowledgeBaseReadService).requireItem("art-1");
        order.verify(knowledgeBaseTagService).removeTagFromItem("art-1", "tag-1");
        order.verify(knowledgeBaseReadService).toResponse(article);
        verify(knowledgeBaseReadService, never()).requireTag(anyString());
    }

    @Test
    void removeTagFromUnknownItemIs404AndNothingIsRemoved() throws Exception {
        when(knowledgeBaseReadService.requireItem("missing")).thenThrow(new KnowledgeBaseItemNotFoundException("missing"));

        mockMvc.perform(delete(BASE + "/items/missing/tags/tag-1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ITEM_NOT_FOUND"));

        verifyNoInteractions(knowledgeBaseTagService);
    }

    // -------------------------------------------------------------- folders

    @Test
    void getFoldersReturnsTheFlatFolderList() throws Exception {
        List<KnowledgeBaseItem> folders = List.of(folder("folder-1"), folder("folder-2"));
        when(knowledgeBaseService.getAllFolders()).thenReturn(folders);
        when(knowledgeBaseReadService.toResponses(folders)).thenReturn(List.of(
                KnowledgeBaseItemResponse.builder().id("folder-1").type(KnowledgeBaseItemType.FOLDER).name("Networking").build(),
                KnowledgeBaseItemResponse.builder().id("folder-2").type(KnowledgeBaseItemType.FOLDER).name("VPN").parentId("folder-1").build()));

        mockMvc.perform(get(BASE + "/folders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value("folder-1"))
                .andExpect(jsonPath("$[0].type").value("FOLDER"))
                .andExpect(jsonPath("$[0].name").value("Networking"))
                .andExpect(jsonPath("$[1].id").value("folder-2"))
                .andExpect(jsonPath("$[1].parentId").value("folder-1"));
    }

    @Test
    void getFoldersOfAnEmptyKnowledgeBaseIsAnEmptyArray() throws Exception {
        when(knowledgeBaseService.getAllFolders()).thenReturn(List.of());
        when(knowledgeBaseReadService.toResponses(List.of())).thenReturn(List.of());

        mockMvc.perform(get(BASE + "/folders"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void createFolderIs201WithTheCreatedFolder() throws Exception {
        KnowledgeBaseItem created = folder("folder-9");
        when(knowledgeBaseService.createFolder("Networking", "folder-1")).thenReturn(created);
        when(knowledgeBaseReadService.toResponse(created)).thenReturn(KnowledgeBaseItemResponse.builder()
                .id("folder-9").type(KnowledgeBaseItemType.FOLDER).name("Networking").parentId("folder-1").build());

        mockMvc.perform(json(post(BASE + "/folders"), Map.of("name", "Networking", "parentId", "folder-1")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("folder-9"))
                .andExpect(jsonPath("$.type").value("FOLDER"))
                .andExpect(jsonPath("$.name").value("Networking"))
                .andExpect(jsonPath("$.parentId").value("folder-1"));
    }

    @Test
    void createFolderWithoutParentIdCreatesAtTheRoot() throws Exception {
        KnowledgeBaseItem created = folder("folder-9");
        when(knowledgeBaseService.createFolder("Networking", null)).thenReturn(created);
        when(knowledgeBaseReadService.toResponse(created)).thenReturn(response("folder-9", KnowledgeBaseItemType.FOLDER));

        mockMvc.perform(json(post(BASE + "/folders"), Map.of("name", "Networking")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("folder-9"));

        verify(knowledgeBaseService).createFolder("Networking", null);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void createFolderWithBlankNameIs400(String name) throws Exception {
        mockMvc.perform(json(post(BASE + "/folders"), Map.of("name", name)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("Name is required"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void createFolderWithoutNameIs400() throws Exception {
        mockMvc.perform(json(post(BASE + "/folders"), Map.of("parentId", "folder-1")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void createFolderWithOversizeNameIs400() throws Exception {
        mockMvc.perform(json(post(BASE + "/folders"), Map.of("name", "n".repeat(256))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void createFolderUnderUnknownParentIs400FromTheDomain() throws Exception {
        when(knowledgeBaseService.createFolder("Networking", "missing"))
                .thenThrow(new IllegalArgumentException("Parent folder not found: missing"));

        mockMvc.perform(json(post(BASE + "/folders"), Map.of("name", "Networking", "parentId", "missing")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Parent folder not found: missing"));
    }

    @Test
    void createFolderWithMalformedJsonIs400() throws Exception {
        mockMvc.perform(post(BASE + "/folders").contentType(MediaType.APPLICATION_JSON).content("{\"name\":"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Malformed request body"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void renameFolderRequiresAFolderAndReturnsTheRenamedOne() throws Exception {
        KnowledgeBaseItem renamed = folder("folder-1");
        when(knowledgeBaseService.renameFolder("folder-1", "Networks")).thenReturn(renamed);
        when(knowledgeBaseReadService.toResponse(renamed)).thenReturn(
                KnowledgeBaseItemResponse.builder().id("folder-1").name("Networks").build());

        mockMvc.perform(json(patch(BASE + "/folders/folder-1"), Map.of("name", "Networks")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("folder-1"))
                .andExpect(jsonPath("$.name").value("Networks"));

        InOrder order = inOrder(knowledgeBaseReadService, knowledgeBaseService);
        order.verify(knowledgeBaseReadService).requireItem("folder-1", KnowledgeBaseItemType.FOLDER);
        order.verify(knowledgeBaseService).renameFolder("folder-1", "Networks");
    }

    @Test
    void renameOfAnArticleIdIs404AndNothingIsRenamed() throws Exception {
        when(knowledgeBaseReadService.requireItem("art-1", KnowledgeBaseItemType.FOLDER))
                .thenThrow(new KnowledgeBaseItemNotFoundException("art-1"));

        mockMvc.perform(json(patch(BASE + "/folders/art-1"), Map.of("name", "Networks")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ITEM_NOT_FOUND"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void renameFolderToBlankNameIs400BeforeAnyLookup() throws Exception {
        mockMvc.perform(json(patch(BASE + "/folders/folder-1"), Map.of("name", " ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"));

        verifyNoInteractions(knowledgeBaseService, knowledgeBaseReadService);
    }

    @Test
    void renameFolderToOversizeNameIs400() throws Exception {
        mockMvc.perform(json(patch(BASE + "/folders/folder-1"), Map.of("name", "n".repeat(256))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(knowledgeBaseService, knowledgeBaseReadService);
    }

    @Test
    void renameFolderAcceptsANameOfMaxLength() throws Exception {
        String name = "n".repeat(255);
        KnowledgeBaseItem renamed = folder("folder-1");
        when(knowledgeBaseService.renameFolder("folder-1", name)).thenReturn(renamed);
        when(knowledgeBaseReadService.toResponse(renamed)).thenReturn(response("folder-1", KnowledgeBaseItemType.FOLDER));

        mockMvc.perform(json(patch(BASE + "/folders/folder-1"), Map.of("name", name)))
                .andExpect(status().isOk());
    }

    @Test
    void deleteEmptyFolderIs204WithoutChildrenAction() throws Exception {
        mockMvc.perform(delete(BASE + "/folders/folder-1"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        InOrder order = inOrder(knowledgeBaseReadService, knowledgeBaseService);
        order.verify(knowledgeBaseReadService).requireItem("folder-1", KnowledgeBaseItemType.FOLDER);
        order.verify(knowledgeBaseService).deleteFolder("folder-1", null, null);
    }

    @Test
    void deleteFolderPassesChildrenActionAndMoveTarget() throws Exception {
        mockMvc.perform(delete(BASE + "/folders/folder-1")
                        .param("childrenAction", "MOVE")
                        .param("moveTargetFolderId", "folder-2"))
                .andExpect(status().isNoContent());

        verify(knowledgeBaseService).deleteFolder("folder-1", FolderChildrenAction.MOVE, "folder-2");
    }

    @Test
    void deleteFolderCanArchiveTheChildren() throws Exception {
        mockMvc.perform(delete(BASE + "/folders/folder-1").param("childrenAction", "ARCHIVE"))
                .andExpect(status().isNoContent());

        verify(knowledgeBaseService).deleteFolder("folder-1", FolderChildrenAction.ARCHIVE, null);
    }

    @Test
    void deleteFolderWithUnknownChildrenActionIs400() throws Exception {
        mockMvc.perform(delete(BASE + "/folders/folder-1").param("childrenAction", "PURGE"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"))
                .andExpect(jsonPath("$.message").value("Invalid value 'PURGE' for parameter 'childrenAction'"));

        verifyNoInteractions(knowledgeBaseService, knowledgeBaseReadService);
    }

    @Test
    void deleteOfAnArticleIdIs404AndNothingIsDeleted() throws Exception {
        when(knowledgeBaseReadService.requireItem("art-1", KnowledgeBaseItemType.FOLDER))
                .thenThrow(new KnowledgeBaseItemNotFoundException("art-1"));

        mockMvc.perform(delete(BASE + "/folders/art-1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ITEM_NOT_FOUND"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void deleteNonEmptyFolderWithoutChildrenActionIs400FromTheDomain() throws Exception {
        doThrow(new IllegalArgumentException("Folder has children — childrenAction (MOVE or ARCHIVE) is required."))
                .when(knowledgeBaseService).deleteFolder("folder-1", null, null);

        mockMvc.perform(delete(BASE + "/folders/folder-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Folder has children — childrenAction (MOVE or ARCHIVE) is required."));
    }

    // ------------------------------------------------------------- articles

    @Test
    void getArchivedArticlesPassesSearchTagsAndDecodedCursor() throws Exception {
        List<KnowledgeBaseItem> items = List.of(article("art-1"));
        when(knowledgeBaseService.queryArchivedArticles(eq("vpn"), eq(List.of("tag-1", "tag-2")), any()))
                .thenReturn(page(items, "next-raw", 3));
        when(knowledgeBaseReadService.toResponses(items)).thenReturn(List.of(KnowledgeBaseItemResponse.builder()
                .id("art-1").status(KnowledgeBaseArticleStatus.ARCHIVED).build()));

        mockMvc.perform(get(BASE + "/articles/archived")
                        .param("search", "vpn")
                        .param("tagIds", "tag-1", "tag-2")
                        .param("limit", "5")
                        .param("cursor", CursorCodec.encode("raw-cursor")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].id").value("art-1"))
                .andExpect(jsonPath("$.items[0].status").value("ARCHIVED"))
                .andExpect(jsonPath("$.pageInfo.hasNextPage").value(true))
                .andExpect(jsonPath("$.pageInfo.endCursor").value("next-raw"))
                .andExpect(jsonPath("$.filteredCount").value(3));

        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        verify(knowledgeBaseService).queryArchivedArticles(eq("vpn"), eq(List.of("tag-1", "tag-2")), pagination.capture());
        assertEquals("raw-cursor", pagination.getValue().getCursor());
        assertEquals(5, pagination.getValue().getLimit());
        assertFalse(pagination.getValue().isBackward());
    }

    @Test
    void getArchivedArticlesWithoutParamsIsTheFirstPageOfTwenty() throws Exception {
        when(knowledgeBaseService.queryArchivedArticles(isNull(), isNull(), any())).thenReturn(page(List.of(), null, 0));
        when(knowledgeBaseReadService.toResponses(List.of())).thenReturn(List.of());

        mockMvc.perform(get(BASE + "/articles/archived"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.filteredCount").value(0));

        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        verify(knowledgeBaseService).queryArchivedArticles(isNull(), isNull(), pagination.capture());
        assertNull(pagination.getValue().getCursor());
        assertEquals(20, pagination.getValue().getLimit());
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "101"})
    void getArchivedArticlesLimitOutOfRangeIs400(String limit) throws Exception {
        mockMvc.perform(get(BASE + "/articles/archived").param("limit", limit))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(knowledgeBaseService, knowledgeBaseReadService);
    }

    @Test
    void getArchivedArticlesUnreadableCursorIs400() throws Exception {
        mockMvc.perform(get(BASE + "/articles/archived").param("cursor", "%%%"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Invalid cursor: %%%"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void createArticleRunsAsTheApiKeyOwnerAndIs201() throws Exception {
        KnowledgeBaseItem created = article("art-9");
        when(principalResolver.resolve(ExternalApiMockMvc.USER_ID)).thenReturn(owner());
        when(knowledgeBaseService.createArticle(eq(OWNER_ID), any())).thenReturn(created);
        when(knowledgeBaseReadService.toResponse(created)).thenReturn(KnowledgeBaseItemResponse.builder()
                .id("art-9")
                .type(KnowledgeBaseItemType.ARTICLE)
                .name("VPN setup")
                .content("# Steps")
                .status(KnowledgeBaseArticleStatus.PUBLISHED)
                .createdBy(OWNER_ID)
                .build());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "VPN setup");
        body.put("parentId", "folder-1");
        body.put("content", "# Steps");
        body.put("summary", "How to");
        body.put("status", "PUBLISHED");
        body.put("tagIds", List.of("tag-1"));
        body.put("assignedCustomerIds", List.of("customer-1", "customer-2"));
        body.put("assignedDeviceIds", List.of("machine-1"));
        body.put("assignedTicketIds", List.of("ticket-1"));
        body.put("assignedArticleIds", List.of("art-2"));

        mockMvc.perform(json(post(BASE + "/articles"), body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("art-9"))
                .andExpect(jsonPath("$.type").value("ARTICLE"))
                .andExpect(jsonPath("$.name").value("VPN setup"))
                .andExpect(jsonPath("$.content").value("# Steps"))
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.createdBy").value(OWNER_ID));

        ArgumentCaptor<CreateArticleCommand> command = ArgumentCaptor.forClass(CreateArticleCommand.class);
        verify(knowledgeBaseService).createArticle(eq(OWNER_ID), command.capture());
        assertEquals("VPN setup", command.getValue().getName());
        assertEquals("folder-1", command.getValue().getParentId());
        assertEquals("# Steps", command.getValue().getContent());
        assertEquals("How to", command.getValue().getSummary());
        assertEquals(KnowledgeBaseArticleStatus.PUBLISHED, command.getValue().getStatus());
        assertEquals(List.of("tag-1"), command.getValue().getTagIds());
        assertEquals(List.of("customer-1", "customer-2"), command.getValue().getAssignedOrganizationIds());
        assertEquals(List.of("machine-1"), command.getValue().getAssignedDeviceIds());
        assertEquals(List.of("ticket-1"), command.getValue().getAssignedTicketIds());
        assertEquals(List.of("art-2"), command.getValue().getAssignedKnowledgeArticleIds());
    }

    @Test
    void createArticleWithNameOnlyLeavesTheRestToTheDomainDefaults() throws Exception {
        KnowledgeBaseItem created = article("art-9");
        when(principalResolver.resolve(ExternalApiMockMvc.USER_ID)).thenReturn(owner());
        when(knowledgeBaseService.createArticle(eq(OWNER_ID), any())).thenReturn(created);
        when(knowledgeBaseReadService.toResponse(created)).thenReturn(response("art-9", KnowledgeBaseItemType.ARTICLE));

        mockMvc.perform(json(post(BASE + "/articles"), Map.of("name", "VPN setup")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("art-9"));

        ArgumentCaptor<CreateArticleCommand> command = ArgumentCaptor.forClass(CreateArticleCommand.class);
        verify(knowledgeBaseService).createArticle(eq(OWNER_ID), command.capture());
        assertEquals("VPN setup", command.getValue().getName());
        assertNull(command.getValue().getParentId());
        assertNull(command.getValue().getStatus());
        assertNull(command.getValue().getTagIds());
        assertNull(command.getValue().getAssignedOrganizationIds());
    }

    @Test
    void createArticleWithBlankNameIs400() throws Exception {
        mockMvc.perform(json(post(BASE + "/articles"), Map.of("name", " ", "content", "# Steps")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("Name is required"));

        verifyNoInteractions(knowledgeBaseService, principalResolver);
    }

    @Test
    void createArticleWithOversizeNameIs400() throws Exception {
        mockMvc.perform(json(post(BASE + "/articles"), Map.of("name", "n".repeat(256))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"));

        verifyNoInteractions(knowledgeBaseService, principalResolver);
    }

    @Test
    void createArticleWithOversizeSummaryIs400() throws Exception {
        mockMvc.perform(json(post(BASE + "/articles"), Map.of("name", "VPN setup", "summary", "s".repeat(1001))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("summary"));

        verifyNoInteractions(knowledgeBaseService, principalResolver);
    }

    @ParameterizedTest
    @ValueSource(strings = {"tagIds", "assignedCustomerIds", "assignedDeviceIds", "assignedTicketIds", "assignedArticleIds"})
    void createArticleWithMoreThanFiftyIdsInAListIs400(String field) throws Exception {
        mockMvc.perform(json(post(BASE + "/articles"), Map.of("name", "VPN setup", field, Collections.nCopies(51, "id"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value(field));

        verifyNoInteractions(knowledgeBaseService, principalResolver);
    }

    @Test
    void createArticleWithUnknownStatusIs400() throws Exception {
        mockMvc.perform(json(post(BASE + "/articles"), Map.of("name", "VPN setup", "status", "DELETED")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Malformed request body"));

        verifyNoInteractions(knowledgeBaseService, principalResolver);
    }

    @Test
    void createArticleUnderUnknownParentIs400FromTheDomain() throws Exception {
        when(principalResolver.resolve(ExternalApiMockMvc.USER_ID)).thenReturn(owner());
        when(knowledgeBaseService.createArticle(eq(OWNER_ID), any()))
                .thenThrow(new IllegalArgumentException("Parent folder not found: missing"));

        mockMvc.perform(json(post(BASE + "/articles"), Map.of("name", "VPN setup", "parentId", "missing")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Parent folder not found: missing"));
    }

    @Test
    void createArticleUnderAnArticleIs409FromTheDomain() throws Exception {
        when(principalResolver.resolve(ExternalApiMockMvc.USER_ID)).thenReturn(owner());
        when(knowledgeBaseService.createArticle(eq(OWNER_ID), any()))
                .thenThrow(new IllegalStateException("Parent must be a folder: art-1"));

        mockMvc.perform(json(post(BASE + "/articles"), Map.of("name", "VPN setup", "parentId", "art-1")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value("Parent must be a folder: art-1"));
    }

    @Test
    void updateArticleRunsAsTheApiKeyOwnerWithTheIdFromThePath() throws Exception {
        KnowledgeBaseItem updated = article("art-1");
        when(principalResolver.resolve(ExternalApiMockMvc.USER_ID)).thenReturn(owner());
        when(knowledgeBaseService.updateArticle(eq(OWNER_ID), any())).thenReturn(updated);
        when(knowledgeBaseReadService.toResponse(updated)).thenReturn(KnowledgeBaseItemResponse.builder()
                .id("art-1").name("New name").content("# New").lastModifiedBy(OWNER_ID).build());

        mockMvc.perform(json(patch(BASE + "/articles/art-1"), Map.of(
                        "name", "New name", "parentId", "folder-2", "content", "# New", "summary", "New summary")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("art-1"))
                .andExpect(jsonPath("$.name").value("New name"))
                .andExpect(jsonPath("$.content").value("# New"))
                .andExpect(jsonPath("$.lastModifiedBy").value(OWNER_ID));

        verify(knowledgeBaseReadService).requireItem("art-1", KnowledgeBaseItemType.ARTICLE);
        ArgumentCaptor<UpdateArticleCommand> command = ArgumentCaptor.forClass(UpdateArticleCommand.class);
        verify(knowledgeBaseService).updateArticle(eq(OWNER_ID), command.capture());
        assertEquals("art-1", command.getValue().getId());
        assertEquals("New name", command.getValue().getName());
        assertEquals("folder-2", command.getValue().getParentId());
        assertEquals("# New", command.getValue().getContent());
        assertEquals("New summary", command.getValue().getSummary());
    }

    @Test
    void updateArticleWithASingleFieldLeavesTheOthersNull() throws Exception {
        KnowledgeBaseItem updated = article("art-1");
        when(principalResolver.resolve(ExternalApiMockMvc.USER_ID)).thenReturn(owner());
        when(knowledgeBaseService.updateArticle(eq(OWNER_ID), any())).thenReturn(updated);
        when(knowledgeBaseReadService.toResponse(updated)).thenReturn(response("art-1", KnowledgeBaseItemType.ARTICLE));

        mockMvc.perform(json(patch(BASE + "/articles/art-1"), Map.of("summary", "New summary")))
                .andExpect(status().isOk());

        ArgumentCaptor<UpdateArticleCommand> command = ArgumentCaptor.forClass(UpdateArticleCommand.class);
        verify(knowledgeBaseService).updateArticle(eq(OWNER_ID), command.capture());
        assertEquals("art-1", command.getValue().getId());
        assertEquals("New summary", command.getValue().getSummary());
        assertNull(command.getValue().getName());
        assertNull(command.getValue().getParentId());
        assertNull(command.getValue().getContent());
    }

    @Test
    void updateOfAFolderIdIs404AndNothingIsUpdated() throws Exception {
        when(knowledgeBaseReadService.requireItem("folder-1", KnowledgeBaseItemType.ARTICLE))
                .thenThrow(new KnowledgeBaseItemNotFoundException("folder-1"));

        mockMvc.perform(json(patch(BASE + "/articles/folder-1"), Map.of("name", "New name")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ITEM_NOT_FOUND"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void updateArticleWithOversizeNameIs400() throws Exception {
        mockMvc.perform(json(patch(BASE + "/articles/art-1"), Map.of("name", "n".repeat(256))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"));

        verifyNoInteractions(knowledgeBaseService, knowledgeBaseReadService);
    }

    @Test
    void updateArticleWithOversizeSummaryIs400() throws Exception {
        mockMvc.perform(json(patch(BASE + "/articles/art-1"), Map.of("summary", "s".repeat(1001))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("summary"));

        verifyNoInteractions(knowledgeBaseService, knowledgeBaseReadService);
    }

    @Test
    void publishArticleRequiresAnArticleAndReturnsThePublishedOne() throws Exception {
        KnowledgeBaseItem published = article("art-1");
        when(knowledgeBaseService.publishArticle("art-1")).thenReturn(published);
        when(knowledgeBaseReadService.toResponse(published)).thenReturn(
                KnowledgeBaseItemResponse.builder().id("art-1").status(KnowledgeBaseArticleStatus.PUBLISHED).build());

        mockMvc.perform(post(BASE + "/articles/art-1/publish"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("art-1"))
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        InOrder order = inOrder(knowledgeBaseReadService, knowledgeBaseService);
        order.verify(knowledgeBaseReadService).requireItem("art-1", KnowledgeBaseItemType.ARTICLE);
        order.verify(knowledgeBaseService).publishArticle("art-1");
    }

    @Test
    void unpublishArticleRequiresAnArticleAndReturnsTheDraft() throws Exception {
        KnowledgeBaseItem draft = article("art-1");
        when(knowledgeBaseService.unpublishArticle("art-1")).thenReturn(draft);
        when(knowledgeBaseReadService.toResponse(draft)).thenReturn(
                KnowledgeBaseItemResponse.builder().id("art-1").status(KnowledgeBaseArticleStatus.DRAFT).build());

        mockMvc.perform(post(BASE + "/articles/art-1/unpublish"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("art-1"))
                .andExpect(jsonPath("$.status").value("DRAFT"));

        InOrder order = inOrder(knowledgeBaseReadService, knowledgeBaseService);
        order.verify(knowledgeBaseReadService).requireItem("art-1", KnowledgeBaseItemType.ARTICLE);
        order.verify(knowledgeBaseService).unpublishArticle("art-1");
    }

    @Test
    void archiveArticleRequiresAnArticleAndReturnsTheArchivedOne() throws Exception {
        KnowledgeBaseItem archived = article("art-1");
        when(knowledgeBaseService.archiveArticle("art-1")).thenReturn(archived);
        when(knowledgeBaseReadService.toResponse(archived)).thenReturn(
                KnowledgeBaseItemResponse.builder().id("art-1").status(KnowledgeBaseArticleStatus.ARCHIVED).build());

        mockMvc.perform(post(BASE + "/articles/art-1/archive"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("art-1"))
                .andExpect(jsonPath("$.status").value("ARCHIVED"));

        InOrder order = inOrder(knowledgeBaseReadService, knowledgeBaseService);
        order.verify(knowledgeBaseReadService).requireItem("art-1", KnowledgeBaseItemType.ARTICLE);
        order.verify(knowledgeBaseService).archiveArticle("art-1");
    }

    @ParameterizedTest
    @ValueSource(strings = {"publish", "unpublish", "archive"})
    void statusChangeOfAFolderIdIs404AndNothingChanges(String action) throws Exception {
        when(knowledgeBaseReadService.requireItem("folder-1", KnowledgeBaseItemType.ARTICLE))
                .thenThrow(new KnowledgeBaseItemNotFoundException("folder-1"));

        mockMvc.perform(post(BASE + "/articles/folder-1/" + action))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ITEM_NOT_FOUND"));

        verifyNoInteractions(knowledgeBaseService);
    }

    @Test
    void unarchiveArticleRestoresIntoTheGivenFolder() throws Exception {
        KnowledgeBaseItem restored = article("art-1");
        when(knowledgeBaseService.unarchiveArticle("art-1", "folder-2")).thenReturn(restored);
        when(knowledgeBaseReadService.toResponse(restored)).thenReturn(KnowledgeBaseItemResponse.builder()
                .id("art-1").parentId("folder-2").status(KnowledgeBaseArticleStatus.PUBLISHED).build());

        mockMvc.perform(json(post(BASE + "/articles/art-1/unarchive"), Map.of("parentId", "folder-2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("art-1"))
                .andExpect(jsonPath("$.parentId").value("folder-2"))
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        InOrder order = inOrder(knowledgeBaseReadService, knowledgeBaseService);
        order.verify(knowledgeBaseReadService).requireItem("art-1", KnowledgeBaseItemType.ARTICLE);
        order.verify(knowledgeBaseService).unarchiveArticle("art-1", "folder-2");
    }

    @Test
    void unarchiveArticleWithoutParentIdRestoresAtTheRoot() throws Exception {
        KnowledgeBaseItem restored = article("art-1");
        when(knowledgeBaseService.unarchiveArticle("art-1", null)).thenReturn(restored);
        when(knowledgeBaseReadService.toResponse(restored)).thenReturn(response("art-1", KnowledgeBaseItemType.ARTICLE));

        mockMvc.perform(json(post(BASE + "/articles/art-1/unarchive"), Map.of()))
                .andExpect(status().isOk());

        verify(knowledgeBaseService).unarchiveArticle("art-1", null);
    }

    @Test
    void unarchiveOfANonArchivedArticleIs409() throws Exception {
        when(knowledgeBaseService.unarchiveArticle("art-1", null))
                .thenThrow(new IllegalStateException("Item is not archived: art-1"));

        mockMvc.perform(json(post(BASE + "/articles/art-1/unarchive"), Map.of()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value("Item is not archived: art-1"));
    }

    @Test
    void unarchiveOfAFolderIdIs404AndNothingIsRestored() throws Exception {
        when(knowledgeBaseReadService.requireItem("folder-1", KnowledgeBaseItemType.ARTICLE))
                .thenThrow(new KnowledgeBaseItemNotFoundException("folder-1"));

        mockMvc.perform(json(post(BASE + "/articles/folder-1/unarchive"), Map.of()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ITEM_NOT_FOUND"));

        verifyNoInteractions(knowledgeBaseService);
    }

    // ----------------------------------------------------------------- tags

    @Test
    void getTagsWithoutParamsReturnsTagsOfActiveArticles() throws Exception {
        when(knowledgeBaseTagService.getAllTags(false)).thenReturn(List.of(tag("tag-1", "network"), tag("tag-2", "vpn")));

        mockMvc.perform(get(BASE + "/tags"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value("tag-1"))
                .andExpect(jsonPath("$[0].key").value("network"))
                .andExpect(jsonPath("$[0].description").value("About network"))
                .andExpect(jsonPath("$[0].color").value("#ff0000"))
                .andExpect(jsonPath("$[0].createdAt").value("2026-01-10T08:00:00.000Z"))
                .andExpect(jsonPath("$[0].createdBy").value("user-a"))
                .andExpect(jsonPath("$[0].entityType").doesNotExist())
                .andExpect(jsonPath("$[0].tenantId").doesNotExist())
                .andExpect(jsonPath("$[1].id").value("tag-2"));

        verifyNoInteractions(knowledgeBaseService, knowledgeBaseReadService);
    }

    @Test
    void getTagsArchivedReturnsTagsOfArchivedArticles() throws Exception {
        when(knowledgeBaseTagService.getAllTags(true)).thenReturn(List.of(tag("tag-3", "legacy")));

        mockMvc.perform(get(BASE + "/tags").param("archived", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", contains("tag-3")));

        verify(knowledgeBaseTagService, never()).getAllTags(false);
    }

    @Test
    void getTagsByFolderReturnsTheSubtreeTags() throws Exception {
        when(knowledgeBaseService.getTagsInSubtree("folder-1")).thenReturn(List.of(tag("tag-1", "network")));

        mockMvc.perform(get(BASE + "/tags").param("folderId", "folder-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", contains("tag-1")));

        verify(knowledgeBaseReadService).requireItem("folder-1", KnowledgeBaseItemType.FOLDER);
        verifyNoInteractions(knowledgeBaseTagService);
    }

    @Test
    void getTagsByFolderIgnoresTheArchivedFlag() throws Exception {
        when(knowledgeBaseService.getTagsInSubtree("folder-1")).thenReturn(List.of());

        mockMvc.perform(get(BASE + "/tags").param("folderId", "folder-1").param("archived", "true"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));

        verify(knowledgeBaseTagService, never()).getAllTags(anyBoolean());
    }

    @Test
    void getTagsOfUnknownFolderIs404() throws Exception {
        when(knowledgeBaseReadService.requireItem("missing", KnowledgeBaseItemType.FOLDER))
                .thenThrow(new KnowledgeBaseItemNotFoundException("missing"));

        mockMvc.perform(get(BASE + "/tags").param("folderId", "missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ITEM_NOT_FOUND"));

        verifyNoInteractions(knowledgeBaseService, knowledgeBaseTagService);
    }

    @Test
    void getTagsWithNonBooleanArchivedIs400() throws Exception {
        mockMvc.perform(get(BASE + "/tags").param("archived", "maybe"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"));

        verifyNoInteractions(knowledgeBaseTagService);
    }

    // ---------------------------------------------------------- attachments

    @Test
    void createAttachmentRegistersTheFileAsTheApiKeyOwnerAndIs201() throws Exception {
        when(principalResolver.resolve(ExternalApiMockMvc.USER_ID)).thenReturn(owner());
        when(knowledgeBaseAttachmentService.createUploadUrl(OWNER_ID, "art-1", "guide.pdf", "application/pdf", 2048L))
                .thenReturn(KnowledgeBaseAttachmentUpload.builder()
                        .attachment(attachment("att-1", "art-1"))
                        .uploadUrl("https://storage.test/upload/att-1")
                        .build());

        mockMvc.perform(json(post(BASE + "/articles/art-1/attachments"),
                        Map.of("fileName", "guide.pdf", "contentType", "application/pdf", "fileSize", 2048)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.uploadUrl").value("https://storage.test/upload/att-1"))
                .andExpect(jsonPath("$.attachment.id").value("att-1"))
                .andExpect(jsonPath("$.attachment.itemId").value("art-1"))
                .andExpect(jsonPath("$.attachment.fileName").value("guide.pdf"))
                .andExpect(jsonPath("$.attachment.contentType").value("application/pdf"))
                .andExpect(jsonPath("$.attachment.fileSize").value(2048))
                .andExpect(jsonPath("$.attachment.uploadedBy").value(OWNER_ID))
                .andExpect(jsonPath("$.attachment.createdAt").value("2026-01-10T08:00:00.000Z"))
                .andExpect(jsonPath("$.attachment.storagePath").doesNotExist());

        verify(knowledgeBaseReadService).requireItem("art-1", KnowledgeBaseItemType.ARTICLE);
    }

    @Test
    void createAttachmentWithoutContentTypePassesNull() throws Exception {
        when(principalResolver.resolve(ExternalApiMockMvc.USER_ID)).thenReturn(owner());
        when(knowledgeBaseAttachmentService.createUploadUrl(OWNER_ID, "art-1", "blob.bin", null, 1L))
                .thenReturn(KnowledgeBaseAttachmentUpload.builder()
                        .attachment(attachment("att-1", "art-1"))
                        .uploadUrl("https://storage.test/upload/att-1")
                        .build());

        mockMvc.perform(json(post(BASE + "/articles/art-1/attachments"), Map.of("fileName", "blob.bin", "fileSize", 1)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attachment.id").value("att-1"));
    }

    @Test
    void createAttachmentOnAFolderIdIs404AndNothingIsRegistered() throws Exception {
        when(knowledgeBaseReadService.requireItem("folder-1", KnowledgeBaseItemType.ARTICLE))
                .thenThrow(new KnowledgeBaseItemNotFoundException("folder-1"));

        mockMvc.perform(json(post(BASE + "/articles/folder-1/attachments"), Map.of("fileName", "guide.pdf", "fileSize", 2048)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ITEM_NOT_FOUND"));

        verifyNoInteractions(knowledgeBaseAttachmentService);
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1})
    void createAttachmentWithNonPositiveFileSizeIs400(long fileSize) throws Exception {
        mockMvc.perform(json(post(BASE + "/articles/art-1/attachments"), Map.of("fileName", "guide.pdf", "fileSize", fileSize)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("fileSize"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("File size must be positive"));

        verifyNoInteractions(knowledgeBaseAttachmentService, knowledgeBaseReadService, principalResolver);
    }

    @Test
    void createAttachmentWithoutFileSizeIs400() throws Exception {
        mockMvc.perform(json(post(BASE + "/articles/art-1/attachments"), Map.of("fileName", "guide.pdf")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("fileSize"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("File size is required"));

        verifyNoInteractions(knowledgeBaseAttachmentService);
    }

    @Test
    void createAttachmentWithBlankFileNameIs400() throws Exception {
        mockMvc.perform(json(post(BASE + "/articles/art-1/attachments"), Map.of("fileName", " ", "fileSize", 2048)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("fileName"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("File name is required"));

        verifyNoInteractions(knowledgeBaseAttachmentService);
    }

    @Test
    void createAttachmentWithOversizeFileNameIs400() throws Exception {
        mockMvc.perform(json(post(BASE + "/articles/art-1/attachments"), Map.of("fileName", "f".repeat(256), "fileSize", 2048)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("fileName"));

        verifyNoInteractions(knowledgeBaseAttachmentService);
    }

    @Test
    void getAttachmentDownloadUrlReturnsASignedUrl() throws Exception {
        when(knowledgeBaseAttachmentService.generateDownloadUrl("att-1")).thenReturn("https://storage.test/download/att-1");

        mockMvc.perform(get(BASE + "/attachments/att-1/download-url"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.downloadUrl").value("https://storage.test/download/att-1"));

        InOrder order = inOrder(knowledgeBaseReadService, knowledgeBaseAttachmentService);
        order.verify(knowledgeBaseReadService).requireAttachment("att-1");
        order.verify(knowledgeBaseAttachmentService).generateDownloadUrl("att-1");
    }

    @Test
    void downloadUrlOfUnknownAttachmentIs404AndNoUrlIsSigned() throws Exception {
        when(knowledgeBaseReadService.requireAttachment("missing")).thenThrow(new KnowledgeBaseAttachmentNotFoundException("missing"));

        mockMvc.perform(get(BASE + "/attachments/missing/download-url"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ATTACHMENT_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Knowledge base attachment not found: missing"));

        verifyNoInteractions(knowledgeBaseAttachmentService);
    }

    @Test
    void deleteAttachmentIs204() throws Exception {
        mockMvc.perform(delete(BASE + "/attachments/att-1"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        InOrder order = inOrder(knowledgeBaseReadService, knowledgeBaseAttachmentService);
        order.verify(knowledgeBaseReadService).requireAttachment("att-1");
        order.verify(knowledgeBaseAttachmentService).deleteAttachment("att-1");
    }

    @Test
    void deleteOfUnknownAttachmentIs404AndNothingIsDeleted() throws Exception {
        when(knowledgeBaseReadService.requireAttachment("missing")).thenThrow(new KnowledgeBaseAttachmentNotFoundException("missing"));

        mockMvc.perform(delete(BASE + "/attachments/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("KNOWLEDGE_BASE_ATTACHMENT_NOT_FOUND"));

        verifyNoInteractions(knowledgeBaseAttachmentService);
    }

    // -------------------------------------------------------------- helpers

    private MockMvc mockMvcWithRealReadService() {
        KnowledgeBaseMapper mapper = new KnowledgeBaseMapper();
        KnowledgeBaseReadService realReadService = new KnowledgeBaseReadService(
                knowledgeBaseService, knowledgeBaseTagService, knowledgeBaseAttachmentService,
                mock(TagRepository.class), mock(KnowledgeBaseItemAttachmentRepository.class), mapper);
        return ExternalApiMockMvc.standalone(new KnowledgeBaseController(
                knowledgeBaseService, knowledgeBaseTagService, knowledgeBaseAttachmentService,
                realReadService, mapper, principalResolver));
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return request.contentType(MediaType.APPLICATION_JSON)
                .content(ExternalApiMockMvc.objectMapper().writeValueAsString(body));
    }

    private static AuthPrincipal owner() {
        return AuthPrincipal.builder().id(OWNER_ID).email("owner@example.test").build();
    }

    private static CountedGenericQueryResult<KnowledgeBaseItem> page(List<KnowledgeBaseItem> items, String endCursor, int filteredCount) {
        return CountedGenericQueryResult.<KnowledgeBaseItem>builder()
                .items(items)
                .pageInfo(PageInfo.builder().hasNextPage(endCursor != null).endCursor(endCursor).build())
                .filteredCount(filteredCount)
                .build();
    }

    private static KnowledgeBaseItemResponse response(String id, KnowledgeBaseItemType type) {
        return KnowledgeBaseItemResponse.builder().id(id).type(type).build();
    }

    private static KnowledgeBaseItem article(String id) {
        return KnowledgeBaseItem.builder()
                .id(id)
                .type(KnowledgeBaseItemType.ARTICLE)
                .name("Article " + id)
                .content("content of " + id)
                .summary("summary of " + id)
                .status(KnowledgeBaseArticleStatus.DRAFT)
                .build();
    }

    private static KnowledgeBaseItem folder(String id) {
        return KnowledgeBaseItem.builder().id(id).type(KnowledgeBaseItemType.FOLDER).name("Folder " + id).build();
    }

    private static Tag tag(String id, String key) {
        return Tag.builder()
                .id(id)
                .tenantId("tenant-1")
                .key(key)
                .description("About " + key)
                .color("#ff0000")
                .entityType(TagEntityType.KNOWLEDGE_ARTICLE)
                .createdAt(Instant.parse("2026-01-10T08:00:00.000Z"))
                .createdBy("user-a")
                .build();
    }

    private static KnowledgeBaseItemAttachment attachment(String id, String itemId) {
        return KnowledgeBaseItemAttachment.builder()
                .id(id)
                .tenantId("tenant-1")
                .itemId(itemId)
                .fileName("guide.pdf")
                .storagePath("kb/" + itemId + "/guide.pdf")
                .fileSize(2048L)
                .contentType("application/pdf")
                .uploadedBy(OWNER_ID)
                .createdAt(Instant.parse("2026-01-10T08:00:00.000Z"))
                .build();
    }
}
