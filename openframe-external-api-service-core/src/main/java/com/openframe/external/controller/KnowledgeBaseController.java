package com.openframe.external.controller;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.knowledgebase.FolderChildrenAction;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseAttachmentUpload;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.service.knowledgebase.KnowledgeBaseAttachmentService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseTagService;
import com.openframe.core.dto.ErrorResponse;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.external.dto.knowledgebase.*;
import com.openframe.external.mapper.KnowledgeBaseMapper;
import com.openframe.external.security.ApiKeyPrincipalResolver;
import com.openframe.external.service.KnowledgeBaseReadService;
import com.openframe.external.util.ExternalCursors;
import com.openframe.external.web.ApiCaller;
import com.openframe.security.authentication.AuthPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static org.springframework.http.HttpStatus.*;

/**
 * External REST API for the knowledge base. Runs the shared knowledge base domain services
 * (openframe-api-lib) on behalf of the API key owner, so folder/article rules — parent validation,
 * archive semantics, tag and assignment handling — are the same as in the dashboard.
 */
@RestController
@RequestMapping("/api/v1/knowledge-base")
@RequiredArgsConstructor
@Slf4j
@Validated
@Tag(name = "Knowledge Base API v1", description = "Knowledge base folders, articles, tags and attachments")
public class KnowledgeBaseController {

    private final KnowledgeBaseService knowledgeBaseService;
    private final KnowledgeBaseTagService knowledgeBaseTagService;
    private final KnowledgeBaseAttachmentService knowledgeBaseAttachmentService;
    private final KnowledgeBaseReadService knowledgeBaseReadService;
    private final KnowledgeBaseMapper knowledgeBaseMapper;
    private final ApiKeyPrincipalResolver principalResolver;

    // ---------------------------------------------------------------- items

    @Operation(summary = "Get list of knowledge base items",
            description = "Retrieve a cursor-paginated list of folders and articles. Without parentId the root level " +
                    "is listed; folders come first, then articles. A search or a tag filter under a folder scans " +
                    "the whole subtree. Archived articles are not included — see /articles/archived. " +
                    "Article content is omitted here; read a single item to get it.")
    @GetMapping("/items")
    @ResponseStatus(OK)
    public KnowledgeBaseItemsResponse getItems(
            @Parameter(description = "Folder id to list; omit for the root level")
            @RequestParam(required = false) String parentId,
            @Parameter(description = "Restrict to FOLDER or ARTICLE items")
            @RequestParam(required = false) KnowledgeBaseItemType type,
            @Parameter(description = "Article statuses to include (DRAFT, PUBLISHED); default: both")
            @RequestParam(required = false) List<KnowledgeBaseArticleStatus> statuses,
            @Parameter(description = "Tag ids to filter by (see /tags)")
            @RequestParam(required = false) List<String> tagIds,
            @Parameter(description = "Search in name and summary")
            @RequestParam(required = false) String search,
            @Parameter(description = "Maximum number of items to return (default: 20, max: 100)")
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer limit,
            @Parameter(description = "Cursor for pagination (from pageInfo.endCursor). An unreadable cursor is rejected with 400.")
            @RequestParam(required = false) String cursor,
            @Parameter(hidden = true) ApiCaller caller) {

        log.debug("Getting KB items - parentId: {}, type: {}, search: {}, limit: {}, cursor: {} - userId: {}, apiKeyId: {}",
                parentId, type, search, limit, cursor, caller.userId(), caller.apiKeyId());

        KnowledgeBaseFilterCriteria filter = KnowledgeBaseFilterCriteria.builder()
                .parentId(parentId)
                .type(type)
                .tagIds(tagIds)
                .statuses(statuses)
                .build();
        CountedGenericQueryResult<KnowledgeBaseItem> result =
                knowledgeBaseService.queryItems(filter, search, pagination(cursor, limit));
        return knowledgeBaseMapper.toItemsResponse(result, knowledgeBaseReadService.toResponses(result.getItems()));
    }

    @Operation(summary = "Get knowledge base item by ID",
            description = "Retrieve a single folder or article with its content, tags and attachment metadata")
    @ApiResponses({
            @ApiResponse(responseCode = "404", description = "Item not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/items/{id}")
    @ResponseStatus(OK)
    public KnowledgeBaseItemResponse getItem(
            @Parameter(description = "Item ID") @PathVariable String id,
            @Parameter(hidden = true) ApiCaller caller) {

        log.debug("Getting KB item {} - userId: {}, apiKeyId: {}", id, caller.userId(), caller.apiKeyId());
        return knowledgeBaseReadService.toResponse(knowledgeBaseReadService.requireItem(id));
    }

    @Operation(summary = "Move an item to another folder",
            description = "Re-parent a folder or article. A folder cannot be moved into itself or its own descendant.")
    @ApiResponses({
            @ApiResponse(responseCode = "404", description = "Item not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/items/{id}/move")
    @ResponseStatus(OK)
    public KnowledgeBaseItemResponse moveItem(
            @Parameter(description = "Item ID") @PathVariable String id,
            @Valid @RequestBody MoveKnowledgeBaseItemRequest request,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Moving KB item {} to folder {} - userId: {}, apiKeyId: {}", id, request.parentId(), caller.userId(), caller.apiKeyId());
        knowledgeBaseReadService.requireItem(id);
        return knowledgeBaseReadService.toResponse(knowledgeBaseService.moveToFolder(id, request.parentId()));
    }

    @Operation(summary = "Add a tag to an item")
    @ApiResponses({
            @ApiResponse(responseCode = "404", description = "Item or tag not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/items/{id}/tags/{tagId}")
    @ResponseStatus(OK)
    public KnowledgeBaseItemResponse addTag(
            @Parameter(description = "Item ID") @PathVariable String id,
            @Parameter(description = "Tag ID (see /tags)") @PathVariable String tagId,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Adding tag {} to KB item {} - userId: {}, apiKeyId: {}", tagId, id, caller.userId(), caller.apiKeyId());
        knowledgeBaseReadService.requireItem(id);
        knowledgeBaseReadService.requireTag(tagId);
        knowledgeBaseTagService.addTagToItem(id, tagId);
        return getItem(id, caller);
    }

    @Operation(summary = "Remove a tag from an item")
    @ApiResponses({
            @ApiResponse(responseCode = "404", description = "Item not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @DeleteMapping("/items/{id}/tags/{tagId}")
    @ResponseStatus(OK)
    public KnowledgeBaseItemResponse removeTag(
            @Parameter(description = "Item ID") @PathVariable String id,
            @Parameter(description = "Tag ID") @PathVariable String tagId,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Removing tag {} from KB item {} - userId: {}, apiKeyId: {}", tagId, id, caller.userId(), caller.apiKeyId());
        knowledgeBaseReadService.requireItem(id);
        knowledgeBaseTagService.removeTagFromItem(id, tagId);
        return getItem(id, caller);
    }

    // -------------------------------------------------------------- folders

    @Operation(summary = "Get the folder tree",
            description = "Retrieve every folder (flat list ordered by name; build the tree from parentId)")
    @GetMapping("/folders")
    @ResponseStatus(OK)
    public List<KnowledgeBaseItemResponse> getFolders(
            @Parameter(hidden = true) ApiCaller caller) {

        log.debug("Getting KB folder tree - userId: {}, apiKeyId: {}", caller.userId(), caller.apiKeyId());
        return knowledgeBaseReadService.toResponses(knowledgeBaseService.getAllFolders());
    }

    @Operation(summary = "Create a folder")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Folder created",
                    content = @Content(schema = @Schema(implementation = KnowledgeBaseItemResponse.class)))
    })
    @PostMapping("/folders")
    @ResponseStatus(CREATED)
    public KnowledgeBaseItemResponse createFolder(
            @Valid @RequestBody CreateFolderRequest request,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Creating KB folder '{}' under {} - userId: {}, apiKeyId: {}", request.name(), request.parentId(), caller.userId(), caller.apiKeyId());
        return knowledgeBaseReadService.toResponse(knowledgeBaseService.createFolder(request.name(), request.parentId()));
    }

    @Operation(summary = "Rename a folder")
    @ApiResponses({
            @ApiResponse(responseCode = "404", description = "Folder not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/folders/{id}")
    @ResponseStatus(OK)
    public KnowledgeBaseItemResponse renameFolder(
            @Parameter(description = "Folder ID") @PathVariable String id,
            @Valid @RequestBody RenameFolderRequest request,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Renaming KB folder {} to '{}' - userId: {}, apiKeyId: {}", id, request.name(), caller.userId(), caller.apiKeyId());
        requireType(id, KnowledgeBaseItemType.FOLDER);
        return knowledgeBaseReadService.toResponse(knowledgeBaseService.renameFolder(id, request.name()));
    }

    @Operation(summary = "Delete a folder",
            description = "Hard-deletes the folder. A non-empty folder requires childrenAction: MOVE re-parents the " +
                    "children to moveTargetFolderId (root when omitted), ARCHIVE archives every article in the subtree " +
                    "and deletes the sub-folders.")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Folder deleted"),
            @ApiResponse(responseCode = "400", description = "Folder has children and childrenAction is missing, or the move target is invalid",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "Folder not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @DeleteMapping("/folders/{id}")
    @ResponseStatus(NO_CONTENT)
    public void deleteFolder(
            @Parameter(description = "Folder ID") @PathVariable String id,
            @Parameter(description = "What to do with the children: MOVE or ARCHIVE (required when the folder is not empty)")
            @RequestParam(required = false) FolderChildrenAction childrenAction,
            @Parameter(description = "Folder to move the children into when childrenAction=MOVE; omit for the root")
            @RequestParam(required = false) String moveTargetFolderId,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Deleting KB folder {} (childrenAction={}, moveTarget={}) - userId: {}, apiKeyId: {}",
                id, childrenAction, moveTargetFolderId, caller.userId(), caller.apiKeyId());
        requireType(id, KnowledgeBaseItemType.FOLDER);
        knowledgeBaseService.deleteFolder(id, childrenAction, moveTargetFolderId);
    }

    // ------------------------------------------------------------- articles

    @Operation(summary = "Get archived articles",
            description = "Retrieve a cursor-paginated list of archived articles with optional search and tag filter")
    @GetMapping("/articles/archived")
    @ResponseStatus(OK)
    public KnowledgeBaseItemsResponse getArchivedArticles(
            @Parameter(description = "Search in name and summary")
            @RequestParam(required = false) String search,
            @Parameter(description = "Tag ids to filter by (see /tags?archived=true)")
            @RequestParam(required = false) List<String> tagIds,
            @Parameter(description = "Maximum number of items to return (default: 20, max: 100)")
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer limit,
            @Parameter(description = "Cursor for pagination (from pageInfo.endCursor). An unreadable cursor is rejected with 400.")
            @RequestParam(required = false) String cursor,
            @Parameter(hidden = true) ApiCaller caller) {

        log.debug("Getting archived KB articles - search: {}, limit: {}, cursor: {} - userId: {}, apiKeyId: {}",
                search, limit, cursor, caller.userId(), caller.apiKeyId());

        CountedGenericQueryResult<KnowledgeBaseItem> result =
                knowledgeBaseService.queryArchivedArticles(search, tagIds, pagination(cursor, limit));
        return knowledgeBaseMapper.toItemsResponse(result, knowledgeBaseReadService.toResponses(result.getItems()));
    }

    @Operation(summary = "Create an article",
            description = "Create an article on behalf of the API key owner, exactly as from the dashboard: " +
                    "it lands in the given folder as DRAFT unless a status is provided, and tags and " +
                    "customer/device/ticket/article assignments are applied.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Article created",
                    content = @Content(schema = @Schema(implementation = KnowledgeBaseItemResponse.class)))
    })
    @PostMapping("/articles")
    @ResponseStatus(CREATED)
    public KnowledgeBaseItemResponse createArticle(
            @Valid @RequestBody CreateArticleRequest request,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Creating KB article '{}' - userId: {}, apiKeyId: {}", request.name(), caller.userId(), caller.apiKeyId());
        AuthPrincipal principal = principalResolver.resolve(caller.userId());
        KnowledgeBaseItem created = knowledgeBaseService.createArticle(
                principal.getId(), knowledgeBaseMapper.toCreateCommand(request));
        return knowledgeBaseReadService.toResponse(created);
    }

    @Operation(summary = "Update an article",
            description = "Partially update name, folder, content and summary. Use the publish/unpublish/archive " +
                    "endpoints to change the status and the tag endpoints to change tags.")
    @ApiResponses({
            @ApiResponse(responseCode = "404", description = "Article not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PatchMapping("/articles/{id}")
    @ResponseStatus(OK)
    public KnowledgeBaseItemResponse updateArticle(
            @Parameter(description = "Article ID") @PathVariable String id,
            @Valid @RequestBody UpdateArticleRequest request,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Updating KB article {} - userId: {}, apiKeyId: {}", id, caller.userId(), caller.apiKeyId());
        AuthPrincipal principal = principalResolver.resolve(caller.userId());
        requireType(id, KnowledgeBaseItemType.ARTICLE);
        KnowledgeBaseItem updated = knowledgeBaseService.updateArticle(
                principal.getId(), knowledgeBaseMapper.toUpdateCommand(id, request));
        return knowledgeBaseReadService.toResponse(updated);
    }

    @Operation(summary = "Publish an article", description = "Set the article status to PUBLISHED")
    @ApiResponses({
            @ApiResponse(responseCode = "404", description = "Article not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/articles/{id}/publish")
    @ResponseStatus(OK)
    public KnowledgeBaseItemResponse publishArticle(
            @Parameter(description = "Article ID") @PathVariable String id,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Publishing KB article {} - userId: {}, apiKeyId: {}", id, caller.userId(), caller.apiKeyId());
        requireType(id, KnowledgeBaseItemType.ARTICLE);
        return knowledgeBaseReadService.toResponse(knowledgeBaseService.publishArticle(id));
    }

    @Operation(summary = "Unpublish an article", description = "Set the article status back to DRAFT")
    @ApiResponses({
            @ApiResponse(responseCode = "404", description = "Article not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/articles/{id}/unpublish")
    @ResponseStatus(OK)
    public KnowledgeBaseItemResponse unpublishArticle(
            @Parameter(description = "Article ID") @PathVariable String id,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Unpublishing KB article {} - userId: {}, apiKeyId: {}", id, caller.userId(), caller.apiKeyId());
        requireType(id, KnowledgeBaseItemType.ARTICLE);
        return knowledgeBaseReadService.toResponse(knowledgeBaseService.unpublishArticle(id));
    }

    @Operation(summary = "Archive an article",
            description = "Articles are never hard-deleted; ARCHIVED is the terminal state. Archived articles " +
                    "disappear from /items and are listed under /articles/archived.")
    @ApiResponses({
            @ApiResponse(responseCode = "404", description = "Article not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/articles/{id}/archive")
    @ResponseStatus(OK)
    public KnowledgeBaseItemResponse archiveArticle(
            @Parameter(description = "Article ID") @PathVariable String id,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Archiving KB article {} - userId: {}, apiKeyId: {}", id, caller.userId(), caller.apiKeyId());
        requireType(id, KnowledgeBaseItemType.ARTICLE);
        return knowledgeBaseReadService.toResponse(knowledgeBaseService.archiveArticle(id));
    }

    @Operation(summary = "Restore an archived article",
            description = "Move an archived article back into a folder as PUBLISHED")
    @ApiResponses({
            @ApiResponse(responseCode = "404", description = "Article not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "409", description = "Article is not archived",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/articles/{id}/unarchive")
    @ResponseStatus(OK)
    public KnowledgeBaseItemResponse unarchiveArticle(
            @Parameter(description = "Article ID") @PathVariable String id,
            @Valid @RequestBody UnarchiveArticleRequest request,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Unarchiving KB article {} into folder {} - userId: {}, apiKeyId: {}", id, request.parentId(), caller.userId(), caller.apiKeyId());
        requireType(id, KnowledgeBaseItemType.ARTICLE);
        return knowledgeBaseReadService.toResponse(knowledgeBaseService.unarchiveArticle(id, request.parentId()));
    }

    // ----------------------------------------------------------------- tags

    @Operation(summary = "Get knowledge base tags",
            description = "Retrieve the tags in use on articles. With folderId only tags used inside that folder's " +
                    "subtree are returned; with archived=true only tags used on archived articles.")
    @GetMapping("/tags")
    @ResponseStatus(OK)
    public List<KnowledgeBaseTagResponse> getTags(
            @Parameter(description = "Folder id to restrict the tags to its subtree")
            @RequestParam(required = false) String folderId,
            @Parameter(description = "Return tags of archived articles instead of active ones (ignored with folderId)")
            @RequestParam(required = false, defaultValue = "false") boolean archived,
            @Parameter(hidden = true) ApiCaller caller) {

        log.debug("Getting KB tags - folderId: {}, archived: {} - userId: {}, apiKeyId: {}", folderId, archived, caller.userId(), caller.apiKeyId());
        if (folderId != null) {
            requireType(folderId, KnowledgeBaseItemType.FOLDER);
            return knowledgeBaseMapper.toTagResponses(knowledgeBaseService.getTagsInSubtree(folderId));
        }
        return knowledgeBaseMapper.toTagResponses(knowledgeBaseTagService.getAllTags(archived));
    }

    // ---------------------------------------------------------- attachments

    @Operation(summary = "Attach a file to an article",
            description = "Registers the attachment and returns a short-lived signed URL. PUT the file bytes to " +
                    "that URL with the same Content-Type; the metadata is visible on the article immediately.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Attachment registered",
                    content = @Content(schema = @Schema(implementation = KnowledgeBaseAttachmentUploadResponse.class))),
            @ApiResponse(responseCode = "404", description = "Article not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping("/articles/{id}/attachments")
    @ResponseStatus(CREATED)
    public KnowledgeBaseAttachmentUploadResponse createAttachment(
            @Parameter(description = "Article ID") @PathVariable String id,
            @Valid @RequestBody CreateKnowledgeBaseAttachmentRequest request,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Creating KB attachment '{}' on article {} - userId: {}, apiKeyId: {}", request.fileName(), id, caller.userId(), caller.apiKeyId());
        AuthPrincipal principal = principalResolver.resolve(caller.userId());
        requireType(id, KnowledgeBaseItemType.ARTICLE);
        KnowledgeBaseAttachmentUpload upload = knowledgeBaseAttachmentService.createUploadUrl(
                principal.getId(), id, request.fileName(), request.contentType(), request.fileSize());
        return new KnowledgeBaseAttachmentUploadResponse(
                knowledgeBaseMapper.toAttachmentResponse(upload.getAttachment()), upload.getUploadUrl());
    }

    @Operation(summary = "Get an attachment download link",
            description = "Returns a short-lived signed URL to download the file bytes from")
    @ApiResponses({
            @ApiResponse(responseCode = "400", description = "Attachment not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/attachments/{attachmentId}/download-url")
    @ResponseStatus(OK)
    public KnowledgeBaseAttachmentDownloadResponse getAttachmentDownloadUrl(
            @Parameter(description = "Attachment ID") @PathVariable String attachmentId,
            @Parameter(hidden = true) ApiCaller caller) {

        log.debug("Generating KB attachment download URL for {} - userId: {}, apiKeyId: {}", attachmentId, caller.userId(), caller.apiKeyId());
        return new KnowledgeBaseAttachmentDownloadResponse(knowledgeBaseAttachmentService.generateDownloadUrl(attachmentId));
    }

    @Operation(summary = "Delete an attachment", description = "Removes the file from storage and the metadata from the article")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Attachment deleted"),
            @ApiResponse(responseCode = "400", description = "Attachment not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @DeleteMapping("/attachments/{attachmentId}")
    @ResponseStatus(NO_CONTENT)
    public void deleteAttachment(
            @Parameter(description = "Attachment ID") @PathVariable String attachmentId,
            @Parameter(hidden = true) ApiCaller caller) {

        log.info("Deleting KB attachment {} - userId: {}, apiKeyId: {}", attachmentId, caller.userId(), caller.apiKeyId());
        knowledgeBaseAttachmentService.deleteAttachment(attachmentId);
    }

    // -------------------------------------------------------------- helpers

    private static CursorPaginationCriteria pagination(String cursor, Integer limit) {
        return CursorPaginationCriteria.builder()
                .cursor(ExternalCursors.decodeBase64(cursor))
                .limit(limit)
                .build();
    }

    private void requireType(String id, KnowledgeBaseItemType type) {
        knowledgeBaseReadService.requireItem(id, type);
    }
}
