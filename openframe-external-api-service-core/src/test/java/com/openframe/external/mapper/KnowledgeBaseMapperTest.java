package com.openframe.external.mapper;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.knowledgebase.CreateArticleCommand;
import com.openframe.api.dto.knowledgebase.UpdateArticleCommand;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.external.dto.knowledgebase.CreateArticleRequest;
import com.openframe.external.dto.knowledgebase.KnowledgeBaseAttachmentResponse;
import com.openframe.external.dto.knowledgebase.KnowledgeBaseItemResponse;
import com.openframe.external.dto.knowledgebase.KnowledgeBaseItemsResponse;
import com.openframe.external.dto.knowledgebase.KnowledgeBaseTagResponse;
import com.openframe.external.dto.knowledgebase.UpdateArticleRequest;
import com.openframe.external.mapper.KnowledgeBaseMapper.ItemRelations;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class KnowledgeBaseMapperTest {

    private static final Instant CREATED_AT = Instant.parse("2026-01-10T08:00:00Z");
    private static final Instant UPDATED_AT = Instant.parse("2026-01-11T09:30:00Z");
    private static final Instant PUBLISHED_AT = Instant.parse("2026-01-12T10:45:00Z");

    private final KnowledgeBaseMapper mapper = new KnowledgeBaseMapper();

    @Test
    void itemResponseCarriesEveryItemFieldWithContentWhenRequested() {
        KnowledgeBaseItemResponse response = mapper.toItemResponse(article(), ItemRelations.empty(), true);

        assertEquals("art-1", response.getId());
        assertEquals(KnowledgeBaseItemType.ARTICLE, response.getType());
        assertEquals("VPN setup", response.getName());
        assertEquals("folder-1", response.getParentId());
        assertEquals("vpn-setup", response.getSlug());
        assertEquals(3, response.getSortOrder());
        assertEquals("# Steps", response.getContent());
        assertEquals("How to set up the VPN", response.getSummary());
        assertEquals(KnowledgeBaseArticleStatus.PUBLISHED, response.getStatus());
        assertEquals(PUBLISHED_AT, response.getPublishedAt());
        assertEquals("user-a", response.getCreatedBy());
        assertEquals("user-b", response.getLastModifiedBy());
        assertEquals(CREATED_AT, response.getCreatedAt());
        assertEquals(UPDATED_AT, response.getUpdatedAt());
    }

    @Test
    void itemResponseOmitsContentWhenNotRequested() {
        KnowledgeBaseItemResponse response = mapper.toItemResponse(article(), ItemRelations.empty(), false);

        assertNull(response.getContent());
        assertEquals("How to set up the VPN", response.getSummary());
    }

    @Test
    void itemResponseMapsRelatedTagsAndAttachmentsInOrder() {
        ItemRelations relations = new ItemRelations(
                List.of(tag("tag-1", "network"), tag("tag-2", "vpn")),
                List.of(attachment("att-1", "guide.pdf")));

        KnowledgeBaseItemResponse response = mapper.toItemResponse(article(), relations, true);

        assertEquals(List.of("tag-1", "tag-2"), response.getTags().stream().map(KnowledgeBaseTagResponse::getId).toList());
        assertEquals(List.of("att-1"), response.getAttachments().stream().map(KnowledgeBaseAttachmentResponse::getId).toList());
    }

    @Test
    void itemResponseWithNullRelationsHasEmptyTagsAndAttachments() {
        KnowledgeBaseItemResponse response = mapper.toItemResponse(article(), null, true);

        assertTrue(response.getTags().isEmpty());
        assertTrue(response.getAttachments().isEmpty());
    }

    @Test
    void itemResponseWithNullRelationListsHasEmptyTagsAndAttachments() {
        KnowledgeBaseItemResponse response = mapper.toItemResponse(article(), new ItemRelations(null, null), true);

        assertTrue(response.getTags().isEmpty());
        assertTrue(response.getAttachments().isEmpty());
    }

    @Test
    void folderResponseLeavesArticleOnlyFieldsNull() {
        KnowledgeBaseItem folder = KnowledgeBaseItem.builder()
                .id("folder-1")
                .type(KnowledgeBaseItemType.FOLDER)
                .name("Networking")
                .build();

        KnowledgeBaseItemResponse response = mapper.toItemResponse(folder, ItemRelations.empty(), true);

        assertEquals("folder-1", response.getId());
        assertEquals(KnowledgeBaseItemType.FOLDER, response.getType());
        assertEquals("Networking", response.getName());
        assertNull(response.getParentId());
        assertNull(response.getContent());
        assertNull(response.getStatus());
        assertNull(response.getPublishedAt());
    }

    @Test
    void emptyRelationsHoldEmptyLists() {
        ItemRelations relations = ItemRelations.empty();

        assertTrue(relations.tags().isEmpty());
        assertTrue(relations.attachments().isEmpty());
    }

    @Test
    void itemsResponseKeepsTheGivenItemsPageInfoAndFilteredCount() {
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).startCursor("c1").endCursor("c2").build();
        CountedGenericQueryResult<KnowledgeBaseItem> result = CountedGenericQueryResult.<KnowledgeBaseItem>builder()
                .items(List.of(article()))
                .pageInfo(pageInfo)
                .filteredCount(42)
                .build();
        List<KnowledgeBaseItemResponse> items = List.of(KnowledgeBaseItemResponse.builder().id("art-1").build());

        KnowledgeBaseItemsResponse response = mapper.toItemsResponse(result, items);

        assertSame(items, response.getItems());
        assertSame(pageInfo, response.getPageInfo());
        assertEquals(42, response.getFilteredCount());
    }

    @Test
    void tagResponseCarriesEveryPublicTagField() {
        KnowledgeBaseTagResponse response = mapper.toTagResponse(tag("tag-1", "network"));

        assertEquals("tag-1", response.getId());
        assertEquals("network", response.getKey());
        assertEquals("About network", response.getDescription());
        assertEquals("#ff0000", response.getColor());
        assertEquals(CREATED_AT, response.getCreatedAt());
        assertEquals("user-a", response.getCreatedBy());
    }

    @Test
    void tagResponsesKeepOrder() {
        List<KnowledgeBaseTagResponse> responses = mapper.toTagResponses(List.of(tag("tag-2", "vpn"), tag("tag-1", "network")));

        assertEquals(List.of("vpn", "network"), responses.stream().map(KnowledgeBaseTagResponse::getKey).toList());
    }

    @Test
    void nullTagsBecomeAnEmptyList() {
        assertTrue(mapper.toTagResponses(null).isEmpty());
    }

    @Test
    void attachmentResponseCarriesMetadataOnly() {
        KnowledgeBaseAttachmentResponse response = mapper.toAttachmentResponse(attachment("att-1", "guide.pdf"));

        assertEquals("att-1", response.getId());
        assertEquals("art-1", response.getItemId());
        assertEquals("guide.pdf", response.getFileName());
        assertEquals("application/pdf", response.getContentType());
        assertEquals(2048L, response.getFileSize());
        assertEquals("user-a", response.getUploadedBy());
        assertEquals(CREATED_AT, response.getCreatedAt());
    }

    @Test
    void attachmentResponsesKeepOrder() {
        List<KnowledgeBaseAttachmentResponse> responses = mapper.toAttachmentResponses(
                List.of(attachment("att-2", "b.png"), attachment("att-1", "a.png")));

        assertEquals(List.of("att-2", "att-1"), responses.stream().map(KnowledgeBaseAttachmentResponse::getId).toList());
    }

    @Test
    void nullAttachmentsBecomeAnEmptyList() {
        assertTrue(mapper.toAttachmentResponses(null).isEmpty());
    }

    @Test
    void createCommandMapsCustomersToOrganizationsAndArticlesToKnowledgeArticles() {
        CreateArticleRequest request = new CreateArticleRequest(
                "VPN setup", "folder-1", "# Steps", "How to set up the VPN", KnowledgeBaseArticleStatus.PUBLISHED,
                List.of("tag-1"), List.of("customer-1"), List.of("machine-1"), List.of("ticket-1"), List.of("art-9"));

        CreateArticleCommand command = mapper.toCreateCommand(request);

        assertEquals("VPN setup", command.getName());
        assertEquals("folder-1", command.getParentId());
        assertEquals("# Steps", command.getContent());
        assertEquals("How to set up the VPN", command.getSummary());
        assertEquals(KnowledgeBaseArticleStatus.PUBLISHED, command.getStatus());
        assertEquals(List.of("tag-1"), command.getTagIds());
        assertEquals(List.of("customer-1"), command.getAssignedOrganizationIds());
        assertEquals(List.of("machine-1"), command.getAssignedDeviceIds());
        assertEquals(List.of("ticket-1"), command.getAssignedTicketIds());
        assertEquals(List.of("art-9"), command.getAssignedKnowledgeArticleIds());
    }

    @Test
    void createCommandKeepsOmittedFieldsNull() {
        CreateArticleRequest request = new CreateArticleRequest(
                "VPN setup", null, null, null, null, null, null, null, null, null);

        CreateArticleCommand command = mapper.toCreateCommand(request);

        assertEquals("VPN setup", command.getName());
        assertNull(command.getParentId());
        assertNull(command.getContent());
        assertNull(command.getSummary());
        assertNull(command.getStatus());
        assertNull(command.getTagIds());
        assertNull(command.getAssignedOrganizationIds());
        assertNull(command.getAssignedDeviceIds());
        assertNull(command.getAssignedTicketIds());
        assertNull(command.getAssignedKnowledgeArticleIds());
    }

    @Test
    void updateCommandTakesTheIdFromThePathAndTheRestFromTheRequest() {
        UpdateArticleRequest request = new UpdateArticleRequest("New name", "folder-2", "# New", "New summary");

        UpdateArticleCommand command = mapper.toUpdateCommand("art-1", request);

        assertEquals("art-1", command.getId());
        assertEquals("New name", command.getName());
        assertEquals("folder-2", command.getParentId());
        assertEquals("# New", command.getContent());
        assertEquals("New summary", command.getSummary());
    }

    @Test
    void updateCommandKeepsOmittedFieldsNull() {
        UpdateArticleCommand command = mapper.toUpdateCommand("art-1", new UpdateArticleRequest(null, null, null, null));

        assertEquals("art-1", command.getId());
        assertNull(command.getName());
        assertNull(command.getParentId());
        assertNull(command.getContent());
        assertNull(command.getSummary());
    }

    private static KnowledgeBaseItem article() {
        return KnowledgeBaseItem.builder()
                .id("art-1")
                .tenantId("tenant-1")
                .type(KnowledgeBaseItemType.ARTICLE)
                .name("VPN setup")
                .parentId("folder-1")
                .slug("vpn-setup")
                .sortOrder(3)
                .content("# Steps")
                .summary("How to set up the VPN")
                .status(KnowledgeBaseArticleStatus.PUBLISHED)
                .publishedAt(PUBLISHED_AT)
                .createdBy("user-a")
                .lastModifiedBy("user-b")
                .createdAt(CREATED_AT)
                .updatedAt(UPDATED_AT)
                .build();
    }

    private static Tag tag(String id, String key) {
        return Tag.builder()
                .id(id)
                .tenantId("tenant-1")
                .key(key)
                .description("About " + key)
                .color("#ff0000")
                .entityType(TagEntityType.KNOWLEDGE_ARTICLE)
                .createdAt(CREATED_AT)
                .createdBy("user-a")
                .build();
    }

    private static KnowledgeBaseItemAttachment attachment(String id, String fileName) {
        return KnowledgeBaseItemAttachment.builder()
                .id(id)
                .tenantId("tenant-1")
                .itemId("art-1")
                .fileName(fileName)
                .storagePath("kb/art-1/" + fileName)
                .fileSize(2048L)
                .contentType("application/pdf")
                .uploadedBy("user-a")
                .createdAt(CREATED_AT)
                .build();
    }
}
