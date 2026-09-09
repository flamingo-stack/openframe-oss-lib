package com.openframe.external.mapper;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.knowledgebase.CreateArticleCommand;
import com.openframe.api.dto.knowledgebase.UpdateArticleCommand;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.document.tag.Tag;
import com.openframe.external.dto.knowledgebase.*;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class KnowledgeBaseMapper extends BaseRestMapper {

    /** Per-item related data gathered by the read service. */
    public record ItemRelations(List<Tag> tags, List<KnowledgeBaseItemAttachment> attachments) {
        public static ItemRelations empty() {
            return new ItemRelations(List.of(), List.of());
        }
    }

    public KnowledgeBaseItemResponse toItemResponse(KnowledgeBaseItem item, ItemRelations relations, boolean includeContent) {
        ItemRelations rel = relations != null ? relations : ItemRelations.empty();
        return KnowledgeBaseItemResponse.builder()
                .id(item.getId())
                .type(item.getType())
                .name(item.getName())
                .parentId(item.getParentId())
                .slug(item.getSlug())
                .sortOrder(item.getSortOrder())
                .content(includeContent ? item.getContent() : null)
                .summary(item.getSummary())
                .status(item.getStatus())
                .publishedAt(item.getPublishedAt())
                .createdBy(item.getCreatedBy())
                .lastModifiedBy(item.getLastModifiedBy())
                .createdAt(item.getCreatedAt())
                .updatedAt(item.getUpdatedAt())
                .tags(toTagResponses(rel.tags()))
                .attachments(toAttachmentResponses(rel.attachments()))
                .build();
    }

    public KnowledgeBaseItemsResponse toItemsResponse(CountedGenericQueryResult<KnowledgeBaseItem> result,
                                                      List<KnowledgeBaseItemResponse> items) {
        return KnowledgeBaseItemsResponse.builder()
                .items(items)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }

    public KnowledgeBaseTagResponse toTagResponse(Tag tag) {
        return KnowledgeBaseTagResponse.builder()
                .id(tag.getId())
                .key(tag.getKey())
                .description(tag.getDescription())
                .color(tag.getColor())
                .createdAt(tag.getCreatedAt())
                .createdBy(tag.getCreatedBy())
                .build();
    }

    public List<KnowledgeBaseTagResponse> toTagResponses(List<Tag> tags) {
        return tags == null ? List.of() : tags.stream().map(this::toTagResponse).toList();
    }

    public KnowledgeBaseAttachmentResponse toAttachmentResponse(KnowledgeBaseItemAttachment attachment) {
        return KnowledgeBaseAttachmentResponse.builder()
                .id(attachment.getId())
                .itemId(attachment.getItemId())
                .fileName(attachment.getFileName())
                .contentType(attachment.getContentType())
                .fileSize(attachment.getFileSize())
                .uploadedBy(attachment.getUploadedBy())
                .createdAt(attachment.getCreatedAt())
                .build();
    }

    public List<KnowledgeBaseAttachmentResponse> toAttachmentResponses(List<KnowledgeBaseItemAttachment> attachments) {
        return attachments == null ? List.of() : attachments.stream().map(this::toAttachmentResponse).toList();
    }

    public CreateArticleCommand toCreateCommand(CreateArticleRequest request) {
        return CreateArticleCommand.builder()
                .name(request.name())
                .parentId(request.parentId())
                .content(request.content())
                .summary(request.summary())
                .status(request.status())
                .tagIds(request.tagIds())
                .assignedOrganizationIds(request.assignedCustomerIds())
                .assignedDeviceIds(request.assignedDeviceIds())
                .assignedTicketIds(request.assignedTicketIds())
                .assignedKnowledgeArticleIds(request.assignedArticleIds())
                .build();
    }

    public UpdateArticleCommand toUpdateCommand(String id, UpdateArticleRequest request) {
        return UpdateArticleCommand.builder()
                .id(id)
                .name(request.name())
                .parentId(request.parentId())
                .content(request.content())
                .summary(request.summary())
                .build();
    }
}
