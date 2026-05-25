package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import graphql.relay.Relay;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.knowledgebase.CreateArticleInput;
import com.openframe.api.dto.knowledgebase.CreateKnowledgeBaseAttachmentInput;
import com.openframe.api.dto.knowledgebase.CreateKnowledgeBaseTempAttachmentInput;
import com.openframe.api.dto.knowledgebase.DeleteFolderInput;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseAttachmentUploadPayload;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseTempAttachmentPayload;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterInput;
import com.openframe.api.dto.knowledgebase.LinkKnowledgeBaseTempAttachmentsInput;
import com.openframe.api.dto.knowledgebase.UpdateArticleInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.MutationDeleteInput;
import com.openframe.api.dto.shared.MutationDeletePayload;
import com.openframe.api.mapper.GraphQLKnowledgeBaseMapper;
import com.openframe.api.service.KnowledgeBaseAttachmentService;
import com.openframe.api.service.KnowledgeBaseTempAttachmentService;
import com.openframe.api.service.KnowledgeBaseService;
import com.openframe.api.service.KnowledgeBaseTagService;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.ticket.TempAttachment;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.DataLoader;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.function.Supplier;

@DgsComponent
@Slf4j
@Validated
@RequiredArgsConstructor
public class KnowledgeBaseDataFetcher {

    private static final Relay RELAY = new Relay();

    private final KnowledgeBaseService knowledgeBaseService;
    private final KnowledgeBaseTagService knowledgeBaseTagService;
    private final KnowledgeBaseTempAttachmentService knowledgeBaseTempAttachmentService;
    private final KnowledgeBaseAttachmentService knowledgeBaseAttachmentService;
    private final GraphQLKnowledgeBaseMapper mapper;

    @DgsQuery
    public CountedGenericConnection<GenericEdge<KnowledgeBaseItem>> knowledgeBaseItems(
            @InputArgument @Valid KnowledgeBaseFilterInput filter,
            @InputArgument String search,
            @InputArgument Integer first,
            @InputArgument String after) {
        log.debug("Fetching KB items: filter={}, search={}, first={}, after={}",
                filter, search, first, after);

        KnowledgeBaseFilterCriteria criteria = mapper.toFilterCriteria(filter);
        ConnectionArgs connectionArgs = ConnectionArgs.builder().first(first).after(after).build();
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(connectionArgs);
        CountedGenericQueryResult<KnowledgeBaseItem> result =
                knowledgeBaseService.queryItems(criteria, search, pagination);
        return mapper.toItemConnection(result);
    }

    @DgsQuery
    public KnowledgeBaseItem knowledgeBaseItem(@InputArgument @NotBlank String id) {
        String rawId = RELAY.fromGlobalId(id).getId();
        log.debug("Fetching KB item by global ID: {}, rawId: {}", id, rawId);
        return knowledgeBaseService.getItem(rawId).orElse(null);
    }

    @DgsQuery
    public List<Tag> knowledgeBaseTags(@InputArgument String folderId,
                                       @InputArgument Boolean archived) {
        if (folderId != null) {
            return knowledgeBaseService.getTagsInSubtree(RELAY.fromGlobalId(folderId).getId());
        }
        log.debug("Fetching all KB tags (archived={})", archived);
        return knowledgeBaseTagService.getAllTags(Boolean.TRUE.equals(archived));
    }

    @DgsQuery
    public List<KnowledgeBaseItem> knowledgeBaseFolderTree() {
        log.debug("Fetching all KB folders for tree picker");
        return knowledgeBaseService.getAllFolders();
    }

    @DgsQuery
    public List<KnowledgeBaseItem> knowledgeBaseArticleTree() {
        log.debug("Fetching all KB articles for picker");
        return knowledgeBaseService.getAllArticles();
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<KnowledgeBaseItem>> archivedArticles(
            @InputArgument String search,
            @InputArgument List<String> tagIds,
            @InputArgument Integer first,
            @InputArgument String after) {
        log.debug("Fetching archived KB articles: search={}, tagIds={}", search, tagIds);

        List<String> rawTagIds = tagIds != null
                ? tagIds.stream().map(id -> RELAY.fromGlobalId(id).getId()).toList()
                : null;
        ConnectionArgs connectionArgs = ConnectionArgs.builder().first(first).after(after).build();
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(connectionArgs);
        return mapper.toItemConnection(
                knowledgeBaseService.queryArchivedArticles(search, rawTagIds, pagination));
    }

    @DgsMutation
    public KnowledgeBaseItem createFolder(
            @InputArgument @NotBlank String name,
            @InputArgument String parentId) {
        String rawParentId = parentId != null ? RELAY.fromGlobalId(parentId).getId() : null;
        log.info("Creating folder: {} under parent: {}", name, rawParentId);
        return knowledgeBaseService.createFolder(name, rawParentId);
    }

    @DgsMutation
    public KnowledgeBaseItem renameFolder(
            @InputArgument @NotBlank String id,
            @InputArgument @NotBlank String name) {
        String rawId = RELAY.fromGlobalId(id).getId();
        log.info("Renaming folder {} to {}", rawId, name);
        return knowledgeBaseService.renameFolder(rawId, name);
    }

    @DgsMutation
    public KnowledgeBaseItem createArticle(@InputArgument @Valid CreateArticleInput input) {
        String currentUserId = getCurrentUserId();
        log.info("Creating article: {} by user: {}", input.getName(), currentUserId);
        return knowledgeBaseService.createArticle(currentUserId, mapper.toCreateCommand(input));
    }

    @DgsMutation
    public KnowledgeBaseItem updateArticle(@InputArgument @Valid UpdateArticleInput input) {
        String currentUserId = getCurrentUserId();
        log.info("Updating article: {} by user: {}", input.getId(), currentUserId);
        return knowledgeBaseService.updateArticle(currentUserId, mapper.toUpdateCommand(input));
    }

    @DgsMutation
    public KnowledgeBaseItem publishArticle(@InputArgument @NotBlank String id) {
        String rawId = RELAY.fromGlobalId(id).getId();
        log.info("Publishing article: {}", rawId);
        return knowledgeBaseService.publishArticle(rawId);
    }

    @DgsMutation
    public KnowledgeBaseItem unpublishArticle(@InputArgument @NotBlank String id) {
        String rawId = RELAY.fromGlobalId(id).getId();
        log.info("Unpublishing article: {}", rawId);
        return knowledgeBaseService.unpublishArticle(rawId);
    }

    @DgsMutation
    public KnowledgeBaseItem moveToFolder(
            @InputArgument @NotBlank String id,
            @InputArgument String parentId) {
        String rawId = RELAY.fromGlobalId(id).getId();
        String rawParentId = parentId != null ? RELAY.fromGlobalId(parentId).getId() : null;
        log.info("Moving KB item {} to folder {}", rawId, rawParentId);
        return knowledgeBaseService.moveToFolder(rawId, rawParentId);
    }

    @DgsMutation
    public KnowledgeBaseItem archiveArticle(@InputArgument @NotBlank String id) {
        String rawId = RELAY.fromGlobalId(id).getId();
        log.info("Archiving article: {}", rawId);
        return knowledgeBaseService.archiveArticle(rawId);
    }

    @DgsMutation
    public KnowledgeBaseItem unarchiveArticle(
            @InputArgument @NotBlank String id,
            @InputArgument String parentId) {
        String rawId = RELAY.fromGlobalId(id).getId();
        String rawParentId = parentId != null ? RELAY.fromGlobalId(parentId).getId() : null;
        log.info("Unarchiving article {} into folder {}", rawId, rawParentId);
        return knowledgeBaseService.unarchiveArticle(rawId, rawParentId);
    }

    @DgsMutation
    public boolean deleteFolder(@InputArgument @Valid DeleteFolderInput input) {
        String rawId = RELAY.fromGlobalId(input.getId()).getId();
        String rawTargetId = input.getMoveTargetFolderId() != null
                ? RELAY.fromGlobalId(input.getMoveTargetFolderId()).getId()
                : null;
        log.info("Deleting folder: {} (childrenAction={})", rawId, input.getChildrenAction());
        knowledgeBaseService.deleteFolder(rawId, input.getChildrenAction(), rawTargetId);
        return true;
    }

    @DgsMutation
    public KnowledgeBaseItem addTagToKnowledgeBaseItem(
            @InputArgument @NotBlank String itemId,
            @InputArgument @NotBlank String tagId) {
        String rawItemId = RELAY.fromGlobalId(itemId).getId();
        String rawTagId = RELAY.fromGlobalId(tagId).getId();
        log.info("Adding tag {} to KB item {}", rawTagId, rawItemId);
        knowledgeBaseTagService.addTagToItem(rawItemId, rawTagId);
        return knowledgeBaseService.getItem(rawItemId).orElse(null);
    }

    @DgsMutation
    public KnowledgeBaseItem removeTagFromKnowledgeBaseItem(
            @InputArgument @NotBlank String itemId,
            @InputArgument @NotBlank String tagId) {
        String rawItemId = RELAY.fromGlobalId(itemId).getId();
        String rawTagId = RELAY.fromGlobalId(tagId).getId();
        log.info("Removing tag {} from KB item {}", rawTagId, rawItemId);
        knowledgeBaseTagService.removeTagFromItem(rawItemId, rawTagId);
        return knowledgeBaseService.getItem(rawItemId).orElse(null);
    }

    @DgsQuery
    public String knowledgeBaseAttachmentDownloadUrl(@InputArgument @NotBlank String attachmentId) {
        log.info("Generating download URL for Knowledge Base attachment: {}", attachmentId);
        return knowledgeBaseAttachmentService.generateDownloadUrl(attachmentId);
    }

    @DgsMutation
    public KnowledgeBaseTempAttachmentPayload createKnowledgeBaseTempAttachmentUploadUrl(@InputArgument @Valid CreateKnowledgeBaseTempAttachmentInput input) {
        String currentUserId = getCurrentUserId();
        log.info("Creating Knowledge Base temp attachment upload URL: file={}, size={} by user: {}",
                input.getFileName(), input.getFileSize(), currentUserId);
        return executeMutation(
                () -> knowledgeBaseTempAttachmentService.createUploadUrl(
                        currentUserId, input.getFileName(), input.getContentType(), input.getFileSize()),
                KnowledgeBaseTempAttachmentPayload::success,
                KnowledgeBaseTempAttachmentPayload::error);
    }

    @DgsMutation
    public MutationDeletePayload deleteKnowledgeBaseTempAttachment(@InputArgument @Valid MutationDeleteInput input) {
        String currentUserId = getCurrentUserId();
        log.info("Deleting Knowledge Base temp attachment: {} by user: {}", input.getId(), currentUserId);
        return executeMutation(
                () -> {
                    knowledgeBaseTempAttachmentService.deleteTempAttachment(currentUserId, input.getId());
                    return input.getId();
                },
                MutationDeletePayload::success,
                MutationDeletePayload::error);
    }

    @DgsMutation
    public List<KnowledgeBaseItemAttachment> linkKnowledgeBaseTempAttachmentsToArticle(@InputArgument @Valid LinkKnowledgeBaseTempAttachmentsInput input) {
        String currentUserId = getCurrentUserId();
        String rawArticleId = RELAY.fromGlobalId(input.getArticleId()).getId();
        log.info("Linking {} temp attachments to Knowledge Base article: {} by user: {}",
                input.getTempIds().size(), rawArticleId, currentUserId);
        return knowledgeBaseTempAttachmentService.linkTempAttachmentsToArticle(rawArticleId, input.getTempIds(), currentUserId);
    }

    @DgsMutation
    public KnowledgeBaseAttachmentUploadPayload createKnowledgeBaseAttachmentUploadUrl(@InputArgument @Valid CreateKnowledgeBaseAttachmentInput input) {
        String currentUserId = getCurrentUserId();
        String rawArticleId = RELAY.fromGlobalId(input.getArticleId()).getId();
        log.info("Creating Knowledge Base attachment upload URL for article: {} by user: {}", rawArticleId, currentUserId);
        return executeMutation(
                () -> knowledgeBaseAttachmentService.createUploadUrl(
                        currentUserId, rawArticleId, input.getFileName(), input.getContentType(), input.getFileSize()),
                result -> KnowledgeBaseAttachmentUploadPayload.success(result.getAttachment(), result.getUploadUrl()),
                KnowledgeBaseAttachmentUploadPayload::error);
    }

    @DgsMutation
    public MutationDeletePayload deleteKnowledgeBaseAttachment(@InputArgument @Valid MutationDeleteInput input) {
        log.info("Deleting Knowledge Base attachment: {}", input.getId());
        return executeMutation(
                () -> {
                    knowledgeBaseAttachmentService.deleteAttachment(input.getId());
                    return input.getId();
                },
                MutationDeletePayload::success,
                MutationDeletePayload::error);
    }

    @DgsData(parentType = "TempAttachment", field = "uploadUrl")
    public String tempAttachmentUploadUrl(DgsDataFetchingEnvironment dfe) {
        TempAttachment temp = dfe.getSource();
        return knowledgeBaseTempAttachmentService.generateUploadUrl(temp);
    }

    @DgsData(parentType = "KnowledgeBaseItem", field = "id")
    public String knowledgeBaseItemNodeId(DgsDataFetchingEnvironment dfe) {
        KnowledgeBaseItem item = dfe.getSource();
        return RELAY.toGlobalId("KnowledgeBaseItem", item.getId());
    }

    @DgsData(parentType = "KnowledgeBaseItem", field = "parentId")
    public String knowledgeBaseItemParentId(DgsDataFetchingEnvironment dfe) {
        KnowledgeBaseItem item = dfe.getSource();
        return item.getParentId() != null
                ? RELAY.toGlobalId("KnowledgeBaseItem", item.getParentId())
                : null;
    }

    @DgsData(parentType = "KnowledgeBaseItem", field = "tags")
    public CompletableFuture<List<Tag>> itemTags(DgsDataFetchingEnvironment dfe) {
        KnowledgeBaseItem item = dfe.getSource();
        DataLoader<String, List<Tag>> loader = dfe.getDataLoader("knowledgeBaseTagDataLoader");
        return loader.load(item.getId());
    }

    @DgsData(parentType = "KnowledgeBaseItem", field = "attachments")
    public CompletableFuture<List<KnowledgeBaseItemAttachment>> itemAttachments(DgsDataFetchingEnvironment dfe) {
        KnowledgeBaseItem item = dfe.getSource();
        DataLoader<String, List<KnowledgeBaseItemAttachment>> loader = dfe.getDataLoader("knowledgeBaseAttachmentDataLoader");
        return loader.load(item.getId());
    }

    @DgsData(parentType = "KnowledgeBaseItem", field = "author")
    public CompletableFuture<UserResponse> itemAuthor(DgsDataFetchingEnvironment dfe) {
        KnowledgeBaseItem item = dfe.getSource();
        String userId = item.getLastModifiedBy() != null ? item.getLastModifiedBy() : item.getCreatedBy();
        if (userId == null) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, UserResponse> loader = dfe.getDataLoader("userDataLoader");
        return loader.load(userId);
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return AuthPrincipal.fromJwt((Jwt) auth.getPrincipal()).getId();
    }

    private <T, P> P executeMutation(
            Supplier<T> action,
            Function<T, P> onSuccess,
            Function<String, P> onError) {
        try {
            return onSuccess.apply(action.get());
        } catch (IllegalArgumentException | IllegalStateException e) {
            return onError.apply(e.getMessage());
        }
    }
}
