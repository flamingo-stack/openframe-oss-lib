package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.*;
import graphql.relay.Relay;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.knowledgebase.CreateArticleInput;
import com.openframe.api.dto.knowledgebase.DeleteFolderInput;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterInput;
import com.openframe.api.dto.knowledgebase.UpdateArticleInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.GraphQLKnowledgeBaseMapper;
import com.openframe.api.service.KnowledgeBaseService;
import com.openframe.api.service.KnowledgeBaseTagService;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.user.User;
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

@DgsComponent
@Slf4j
@Validated
@RequiredArgsConstructor
public class KnowledgeBaseDataFetcher {

    private static final Relay RELAY = new Relay();

    private final KnowledgeBaseService knowledgeBaseService;
    private final KnowledgeBaseTagService knowledgeBaseTagService;
    private final GraphQLKnowledgeBaseMapper mapper;

    @DgsQuery
    public CountedGenericConnection<GenericEdge<KnowledgeBaseItem>> knowledgeBaseItems(
            @InputArgument @Valid KnowledgeBaseFilterInput filter,
            @InputArgument String search,
            @InputArgument Integer first,
            @InputArgument String after) {
        String currentUserId = getCurrentUserId();
        log.debug("Fetching KB items for user {}: filter={}, search={}, first={}, after={}",
                currentUserId, filter, search, first, after);

        KnowledgeBaseFilterCriteria criteria = mapper.toFilterCriteria(filter);
        ConnectionArgs connectionArgs = ConnectionArgs.builder().first(first).after(after).build();
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(connectionArgs);
        CountedGenericQueryResult<KnowledgeBaseItem> result =
                knowledgeBaseService.queryItems(currentUserId, criteria, search, pagination);
        return mapper.toItemConnection(result);
    }

    @DgsQuery
    public KnowledgeBaseItem knowledgeBaseItem(@InputArgument @NotBlank String id) {
        String rawId = RELAY.fromGlobalId(id).getId();
        log.debug("Fetching KB item by global ID: {}, rawId: {}", id, rawId);
        return knowledgeBaseService.getItem(rawId).orElse(null);
    }

    @DgsQuery
    public List<Tag> knowledgeBaseTags() {
        log.debug("Fetching all KB tags");
        return knowledgeBaseTagService.getAllTags();
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<KnowledgeBaseItem>> archivedArticles(
            @InputArgument String search,
            @InputArgument List<String> tagIds,
            @InputArgument Integer first,
            @InputArgument String after) {
        String currentUserId = getCurrentUserId();
        log.debug("Fetching archived KB articles for user {}: search={}, tagIds={}", currentUserId, search, tagIds);

        List<String> rawTagIds = tagIds != null
                ? tagIds.stream().map(id -> RELAY.fromGlobalId(id).getId()).toList()
                : null;
        ConnectionArgs connectionArgs = ConnectionArgs.builder().first(first).after(after).build();
        CursorPaginationCriteria pagination = mapper.toCursorPaginationCriteria(connectionArgs);
        return mapper.toItemConnection(
                knowledgeBaseService.queryArchivedArticles(currentUserId, search, rawTagIds, pagination));
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

    @DgsData(parentType = "KnowledgeBaseItem", field = "id")
    public String knowledgeBaseItemNodeId(DgsDataFetchingEnvironment dfe) {
        KnowledgeBaseItem item = dfe.getSource();
        return RELAY.toGlobalId("KnowledgeBaseItem", item.getId());
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
    public CompletableFuture<User> itemAuthor(DgsDataFetchingEnvironment dfe) {
        KnowledgeBaseItem item = dfe.getSource();
        String userId = item.getLastModifiedBy() != null ? item.getLastModifiedBy() : item.getCreatedBy();
        if (userId == null) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, User> loader = dfe.getDataLoader("userDataLoader");
        return loader.load(userId);
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return AuthPrincipal.fromJwt((Jwt) auth.getPrincipal()).getId();
    }
}
