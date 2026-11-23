package com.openframe.api.service.knowledgebase;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.assignment.AssignmentTarget;
import com.openframe.api.dto.knowledgebase.CreateArticleCommand;
import com.openframe.api.dto.knowledgebase.FolderChildrenAction;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseCursors;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseScope;
import com.openframe.api.dto.knowledgebase.UpdateArticleCommand;
import com.openframe.api.dto.shared.CursorPage;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.service.AssignmentService;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.InvalidCursorException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemCursor;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseParentFilter;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class KnowledgeBaseService {

    private final KnowledgeBaseItemRepository repository;
    private final KnowledgeBaseTagService knowledgeBaseTagService;
    private final AssignmentService assignmentService;
    private final KnowledgeBaseTempAttachmentService knowledgeBaseTempAttachmentService;
    private final KnowledgeBaseAttachmentService knowledgeBaseAttachmentService;

    /**
     * One page of a listing: folders first (by name), then articles (most recently updated first),
     * both paged in the database. The cursor says which of the two streams the page continues.
     */
    public CountedGenericQueryResult<KnowledgeBaseItem> queryItems(
            KnowledgeBaseFilterCriteria filter, String search,
            CursorPaginationCriteria paginationCriteria) {
        log.debug("Querying KB items: filter={}, search={}", filter, search);

        CursorPaginationCriteria normalized = paginationCriteria.normalize();
        KnowledgeBaseItemCursor cursor = resolveCursor(normalized.getCursor());

        List<String> restrictToItemIds = resolveItemIdRestriction(filter);
        boolean assigned = filter.getAssignedTo() != null;
        boolean wantsFolders = !assigned && filter.getType() != KnowledgeBaseItemType.ARTICLE;
        boolean wantsArticles = filter.getType() != KnowledgeBaseItemType.FOLDER;
        // Folders and articles always read from the same parents: a search that reaches three
        // levels down for articles reaches three levels down for folders too.
        KnowledgeBaseParentFilter parent = assigned
                ? KnowledgeBaseParentFilter.any()
                : parentFilter(filter.getParentId(), effectiveScope(filter, search, restrictToItemIds != null));
        long folderCount = wantsFolders
                ? repository.countFolders(parent, search, restrictToItemIds)
                : 0;
        long articleCount = wantsArticles
                ? repository.countArticles(parent, search, restrictToItemIds, filter.getStatuses())
                : 0;
        KnowledgeBaseItemListing listing = KnowledgeBaseItemListing.builder()
                .parent(parent)
                .search(search)
                .itemIds(restrictToItemIds)
                .statuses(filter.getStatuses())
                .withFolders(wantsFolders)
                .withArticles(wantsArticles)
                .folderCount(folderCount)
                .articleCount(articleCount)
                .build();

        CursorPage<KnowledgeBaseItem> page = normalized.isBackward()
                ? pageBefore(listing, cursor, normalized)
                : pageAfter(listing, cursor, normalized);
        PageInfo pageInfo = buildPageInfo(page.items(), page.hasNextPage(), page.hasPreviousPage());

        return CountedGenericQueryResult.<KnowledgeBaseItem>builder()
                .items(page.items())
                .pageInfo(pageInfo)
                .filteredCount((int) (folderCount + articleCount))
                .build();
    }

    private CursorPage<KnowledgeBaseItem> pageAfter(KnowledgeBaseItemListing listing, KnowledgeBaseItemCursor cursor,
                                                    CursorPaginationCriteria pagination) {
        int limit = pagination.getLimit();
        // A folder cursor continues the folder stream; an article cursor means the folders have
        // already been served.
        boolean pastFolders = cursor != null && cursor.type() == KnowledgeBaseItemType.ARTICLE;

        List<KnowledgeBaseItem> folders = List.of();
        boolean hasNextPage = false;
        if (listing.isWithFolders() && !pastFolders) {
            List<KnowledgeBaseItem> fetched = fetchFolders(listing, cursor, false, limit);
            hasNextPage = fetched.size() > limit;
            folders = firstRows(fetched, limit);
        }

        List<KnowledgeBaseItem> articles = List.of();
        if (listing.isWithArticles()) {
            int articleLimit = limit - folders.size();
            if (articleLimit > 0) {
                KnowledgeBaseItemCursor articleCursor = pastFolders ? cursor : null;
                List<KnowledgeBaseItem> fetched = fetchArticles(listing, articleCursor, false, articleLimit);
                hasNextPage = fetched.size() > articleLimit;
                articles = firstRows(fetched, articleLimit);
            } else if (!hasNextPage) {
                // A page filled by folders alone still has a next page when articles follow them.
                hasNextPage = listing.getArticleCount() > 0;
            }
        }

        List<KnowledgeBaseItem> combined = Stream.concat(folders.stream(), articles.stream()).toList();
        return new CursorPage<>(combined, hasNextPage, pagination.hasCursor());
    }

    private CursorPage<KnowledgeBaseItem> pageBefore(KnowledgeBaseItemListing listing, KnowledgeBaseItemCursor cursor,
                                                     CursorPaginationCriteria pagination) {
        int limit = pagination.getLimit();
        boolean pastArticles = cursor != null && cursor.type() == KnowledgeBaseItemType.FOLDER;

        List<KnowledgeBaseItem> articles = List.of();
        boolean hasPreviousPage = false;
        if (listing.isWithArticles() && !pastArticles) {
            List<KnowledgeBaseItem> fetched = fetchArticles(listing, cursor, true, limit);
            hasPreviousPage = fetched.size() > limit;
            articles = firstRows(fetched, limit);
        }

        List<KnowledgeBaseItem> folders = List.of();
        if (listing.isWithFolders()) {
            int folderLimit = limit - articles.size();
            if (folderLimit > 0) {
                KnowledgeBaseItemCursor folderCursor = pastArticles ? cursor : null;
                List<KnowledgeBaseItem> fetched = fetchFolders(listing, folderCursor, true, folderLimit);
                hasPreviousPage = fetched.size() > folderLimit;
                folders = firstRows(fetched, folderLimit);
            } else if (!hasPreviousPage) {
                hasPreviousPage = listing.getFolderCount() > 0;
            }
        }

        List<KnowledgeBaseItem> combined =
                Stream.concat(folders.reversed().stream(), articles.reversed().stream()).toList();
        return new CursorPage<>(combined, pagination.hasCursor(), hasPreviousPage);
    }

    private List<KnowledgeBaseItem> fetchFolders(KnowledgeBaseItemListing listing, KnowledgeBaseItemCursor cursor,
                                                 boolean backward, int limit) {
        return repository.findFolders(
                listing.getParent(), listing.getSearch(), listing.getItemIds(), cursor, backward, limit + 1);
    }

    private List<KnowledgeBaseItem> fetchArticles(KnowledgeBaseItemListing listing, KnowledgeBaseItemCursor cursor,
                                                  boolean backward, int limit) {
        return repository.findArticles(
                listing.getParent(), listing.getSearch(), listing.getItemIds(), listing.getStatuses(),
                cursor, backward, limit + 1);
    }

    private static List<KnowledgeBaseItem> firstRows(List<KnowledgeBaseItem> fetched, int limit) {
        return fetched.size() > limit ? fetched.subList(0, limit) : fetched;
    }

    public Optional<KnowledgeBaseItem> getItem(String id) {
        return repository.findById(id);
    }

    public List<KnowledgeBaseItem> getAllFolders() {
        return repository.findByTypeOrderByNameAsc(KnowledgeBaseItemType.FOLDER);
    }

    public List<KnowledgeBaseItem> getAllArticles() {
        return repository.findAllArticles();
    }

    public List<Tag> getTagsInSubtree(String folderId) {
        return tagsOf(collectArticleIdsInSubtree(folderId));
    }

    public List<Tag> getTagsOfAssignedArticles(AssignmentTarget target) {
        List<String> assignedIds = assignmentService.findAssignedItemIds(AssignmentItemType.KNOWLEDGE_ARTICLE, target);
        if (assignedIds.isEmpty()) {
            return List.of();
        }
        List<String> articleIds = repository.findAllById(assignedIds).stream()
                .filter(article -> article.getStatus() != KnowledgeBaseArticleStatus.ARCHIVED)
                .map(KnowledgeBaseItem::getId)
                .toList();
        return tagsOf(articleIds);
    }

    public void validateParentIsFolder(String parentId) {
        if (parentId == null) {
            return;
        }
        KnowledgeBaseItem parent = repository.findById(parentId)
                .orElseThrow(() -> new NotFoundException(ErrorCode.KNOWLEDGE_BASE_ITEM_NOT_FOUND, "Parent folder not found: " + parentId));
        if (parent.getType() != KnowledgeBaseItemType.FOLDER) {
            throw new ConflictException(ErrorCode.CONFLICT, "Parent must be a folder: " + parentId);
        }
    }

    public void requireArchivedItem(String id) {
        KnowledgeBaseItem item = getById(id);
        requireArchived(item, id);
    }

    public void requireDeleteItem(String id, FolderChildrenAction action, String moveTargetFolderId) {
        KnowledgeBaseItem item = getById(id);
        if (hasFolderChildren(item, id)) {
            requireFolderChildrenDestination(action, moveTargetFolderId);
        }
    }

    public KnowledgeBaseItem getById(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException(ErrorCode.KNOWLEDGE_BASE_ITEM_NOT_FOUND, "Knowledge base item not found: " + id));
    }

    private List<Tag> tagsOf(List<String> articleIds) {
        return articleIds.isEmpty()
                ? List.of()
                : knowledgeBaseTagService.getTagsForItemIds(articleIds);
    }

    public CountedGenericQueryResult<KnowledgeBaseItem> queryArchivedArticles(
            String search, List<String> tagIds,
            CursorPaginationCriteria paginationCriteria) {
        log.debug("Querying archived KB articles: search={}, tagIds={}", search, tagIds);
        CursorPaginationCriteria normalized = paginationCriteria.normalize();
        KnowledgeBaseItemCursor cursor = resolveArticleCursor(normalized.getCursor());

        List<String> restrictToItemIds = resolveTagFilter(tagIds);

        long filteredCount = repository.countArchivedArticles(search, restrictToItemIds);
        List<KnowledgeBaseItem> fetched = repository.findArchivedArticles(
                search, restrictToItemIds, cursor, normalized.isBackward(), normalized.getLimit() + 1);
        CursorPage<KnowledgeBaseItem> page = CursorPage.assemble(fetched, normalized);

        PageInfo pageInfo = buildPageInfo(page.items(), page.hasNextPage(), page.hasPreviousPage());

        return CountedGenericQueryResult.<KnowledgeBaseItem>builder()
                .items(page.items())
                .pageInfo(pageInfo)
                .filteredCount((int) filteredCount)
                .build();
    }

    @Transactional
    public KnowledgeBaseItem createFolder(String name, String parentId) {
        log.info("Creating folder: {} under parent: {}", name, parentId);
        validateParentIsFolder(parentId);
        KnowledgeBaseItem folder = KnowledgeBaseItem.builder()
                .type(KnowledgeBaseItemType.FOLDER)
                .name(name)
                .parentId(parentId)
                .build();
        return repository.save(folder);
    }

    @Transactional
    public KnowledgeBaseItem renameFolder(String id, String name) {
        log.info("Renaming folder {} to {}", id, name);
        KnowledgeBaseItem folder = getById(id);
        folder.setName(name);
        return repository.save(folder);
    }

    /**
     * Hard-deletes a folder. If it has children, action determines their fate:
     *   MOVE    — children re-parented to moveTargetFolderId
     *   ARCHIVE — articles archived recursively, sub-folders hard-deleted
     * action may be null only when the folder is empty.
     */
    @Transactional
    public void deleteFolder(String id, FolderChildrenAction action, String moveTargetFolderId) {
        log.info("Deleting folder {} (childrenAction={}, moveTarget={})", id, action, moveTargetFolderId);
        KnowledgeBaseItem folder = getById(id);
        if (folder.getType() != KnowledgeBaseItemType.FOLDER) {
            throw new ConflictException(ErrorCode.CONFLICT, "Only folders can be deleted via deleteFolder. Use archiveArticle for articles.");
        }

        List<KnowledgeBaseItem> children = repository.findByParentId(id);

        if (!children.isEmpty()) {
            requireChildrenAction(action);
            switch (action) {
                case MOVE -> moveChildren(children, moveTargetFolderId, id);
                case ARCHIVE -> archiveSubtree(id);
            }
        }

        repository.deleteById(id);
    }

    @Transactional
    public KnowledgeBaseItem createArticle(String currentUserId, CreateArticleCommand cmd) {
        log.info("Creating article: {} by user: {} under parent: {}", cmd.getName(), currentUserId, cmd.getParentId());
        validateParentIsFolder(cmd.getParentId());
        List<String> tagIds = cmd.getTagIds();
        knowledgeBaseTagService.requireExistingTags(tagIds);
        KnowledgeBaseItem article = KnowledgeBaseItem.builder()
                .type(KnowledgeBaseItemType.ARTICLE)
                .name(cmd.getName())
                .parentId(cmd.getParentId())
                .content(cmd.getContent())
                .summary(cmd.getSummary())
                .status(cmd.getStatus() != null ? cmd.getStatus() : KnowledgeBaseArticleStatus.DRAFT)
                .createdBy(currentUserId)
                .lastModifiedBy(currentUserId)
                .build();
        KnowledgeBaseItem saved = repository.save(article);

        addTags(saved.getId(), tagIds);
        createAssignments(saved.getId(), AssignmentTargetType.ORGANIZATION, cmd.getAssignedOrganizationIds());
        createAssignments(saved.getId(), AssignmentTargetType.DEVICE, cmd.getAssignedDeviceIds());
        createAssignments(saved.getId(), AssignmentTargetType.TICKET, cmd.getAssignedTicketIds());
        createAssignments(saved.getId(), AssignmentTargetType.KNOWLEDGE_ARTICLE, cmd.getAssignedKnowledgeArticleIds());
        knowledgeBaseTempAttachmentService.linkTempAttachmentsToArticle(
                saved.getId(), cmd.getAttachmentTempIds(), currentUserId);

        return saved;
    }

    /**
     * One save of an article: its own fields and status and, when the command carries them, its
     * tags, assignments and attachments. A null field or list is left as it is; an empty list
     * means none.
     *
     * These live in separate collections and nothing here rolls a failed save back, so the order
     * is what keeps a failure from leaving the article half-saved:
     * 1. everything that can be refused is checked before the first write;
     * 2. tags, assignments and new attachments are written first — each is safe to repeat;
     * 3. the article itself follows, text and status in one document write, so a failure up to
     *    here leaves it exactly as it was and never publishes text with half its tags;
     * 4. attachments are deleted last, because that cannot be undone.
     */
    @Transactional
    public KnowledgeBaseItem updateArticle(String currentUserId, UpdateArticleCommand cmd) {
        log.info("Updating article {} by user {}", cmd.getId(), currentUserId);
        KnowledgeBaseItem article = getById(cmd.getId());

        if (cmd.getParentId() != null) {
            if (cmd.isMoveToRoot()) {
                throw new ValidationException("parentId and moveToRoot cannot both be set.");
            }
            validateParentIsFolder(cmd.getParentId());
        }
        if (article.getType() != KnowledgeBaseItemType.ARTICLE && carriesArticleOnlyFields(cmd)) {
            throw new ConflictException(ErrorCode.CONFLICT,
                    "Only articles have a status, tags, assignments and attachments.");
        }
        List<KnowledgeBaseItemAttachment> attachmentsToDelete =
                knowledgeBaseAttachmentService.getArticleAttachments(article.getId(), cmd.getDeleteAttachmentIds());

        if (cmd.getTagIds() != null) {
            knowledgeBaseTagService.replaceItemTags(article.getId(), cmd.getTagIds());
        }
        replaceAssignments(article.getId(), AssignmentTargetType.ORGANIZATION, cmd.getAssignedOrganizationIds());
        replaceAssignments(article.getId(), AssignmentTargetType.DEVICE, cmd.getAssignedDeviceIds());
        replaceAssignments(article.getId(), AssignmentTargetType.TICKET, cmd.getAssignedTicketIds());
        replaceAssignments(article.getId(), AssignmentTargetType.KNOWLEDGE_ARTICLE, cmd.getAssignedKnowledgeArticleIds());
        List<KnowledgeBaseItemAttachment> linked = knowledgeBaseTempAttachmentService.linkTempAttachmentsToArticle(
                article.getId(), cmd.getAttachmentTempIds(), currentUserId);

        if (cmd.getName() != null) {
            article.setName(cmd.getName());
        }
        if (cmd.getParentId() != null) {
            article.setParentId(cmd.getParentId());
        } else if (cmd.isMoveToRoot()) {
            article.setParentId(null);
        }
        if (cmd.getContent() != null) {
            article.setContent(cmd.getContent());
        }
        if (cmd.getSummary() != null) {
            article.setSummary(cmd.getSummary());
        }
        if (cmd.getStatus() != null) {
            // Any status from any status: DRAFT/PUBLISHED on an archived article restores it as
            // exactly that, rather than as PUBLISHED the way unarchiveArticle does.
            article.setStatus(cmd.getStatus());
        }
        article.setLastModifiedBy(currentUserId);
        KnowledgeBaseItem saved = repository.save(article);

        // An attachment replaced by a file of the same name was just overwritten by the link
        // above: its path now holds the new file and must survive the deletion of the old record.
        Set<String> pathsStillInUse = linked.stream()
                .map(KnowledgeBaseItemAttachment::getStoragePath)
                .collect(Collectors.toSet());
        knowledgeBaseAttachmentService.deleteAttachments(attachmentsToDelete, pathsStillInUse);
        return saved;
    }

    /** The fields of a save that only make sense on an article; the older ones a folder has always accepted. */
    private static boolean carriesArticleOnlyFields(UpdateArticleCommand cmd) {
        return Stream.of(
                        cmd.getStatus(), cmd.getTagIds(),
                        cmd.getAssignedOrganizationIds(), cmd.getAssignedDeviceIds(),
                        cmd.getAssignedTicketIds(), cmd.getAssignedKnowledgeArticleIds(),
                        cmd.getAttachmentTempIds(), cmd.getDeleteAttachmentIds())
                .anyMatch(Objects::nonNull);
    }

    @Transactional
    public KnowledgeBaseItem publishArticle(String id) {
        log.info("Publishing article {}", id);
        KnowledgeBaseItem article = getById(id);
        if (article.getType() != KnowledgeBaseItemType.ARTICLE) {
            throw new ConflictException(ErrorCode.CONFLICT, "Only articles can be published.");
        }
        article.setStatus(KnowledgeBaseArticleStatus.PUBLISHED);
        return repository.save(article);
    }

    @Transactional
    public KnowledgeBaseItem unpublishArticle(String id) {
        log.info("Unpublishing article {}", id);
        KnowledgeBaseItem article = getById(id);
        if (article.getType() != KnowledgeBaseItemType.ARTICLE) {
            throw new ConflictException(ErrorCode.CONFLICT, "Only articles can be unpublished.");
        }
        article.setStatus(KnowledgeBaseArticleStatus.DRAFT);
        return repository.save(article);
    }

    @Transactional
    public KnowledgeBaseItem archiveArticle(String id) {
        log.info("Archiving article {}", id);
        KnowledgeBaseItem item = getById(id);
        if (item.getType() != KnowledgeBaseItemType.ARTICLE) {
            throw new ConflictException(ErrorCode.CONFLICT, "Only articles can be archived. Folders must be deleted via deleteFolder.");
        }
        item.setStatus(KnowledgeBaseArticleStatus.ARCHIVED);
        return repository.save(item);
    }

    @Transactional
    public KnowledgeBaseItem unarchiveArticle(String id, String parentId) {
        log.info("Unarchiving article {} into folder {}", id, parentId);
        KnowledgeBaseItem item = getById(id);
        if (item.getType() != KnowledgeBaseItemType.ARTICLE) {
            throw new ConflictException(ErrorCode.CONFLICT, "Only articles can be unarchived.");
        }
        requireArchived(item, id);
        validateParentIsFolder(parentId);
        item.setParentId(parentId);
        item.setStatus(KnowledgeBaseArticleStatus.PUBLISHED);
        return repository.save(item);
    }

    @Transactional
    public KnowledgeBaseItem moveToFolder(String id, String parentId) {
        log.info("Moving item {} to folder {}", id, parentId);
        KnowledgeBaseItem item = getById(id);

        if (parentId != null) {
            if (parentId.equals(id)) {
                throw new ValidationException("Cannot move item to itself.");
            }
            validateParentIsFolder(parentId);
            if (item.getType() == KnowledgeBaseItemType.FOLDER && isDescendantOf(parentId, id)) {
                throw new ConflictException(ErrorCode.CONFLICT, "Cannot move folder into its own descendant.");
            }
        }

        item.setParentId(parentId);
        return repository.save(item);
    }

    /**
     * A listing that names no scope reads one level — unless it narrows by a search or by tags,
     * then it reads the whole subtree. Narrowing a single level is rarely what is meant: the match
     * a user is looking for is usually further down.
     */
    private static KnowledgeBaseScope effectiveScope(KnowledgeBaseFilterCriteria filter, String search,
                                                     boolean tagFiltered) {
        if (filter.getScope() != null) {
            return filter.getScope();
        }
        return StringUtils.hasText(search) || tagFiltered
                ? KnowledgeBaseScope.DESCENDANTS
                : KnowledgeBaseScope.CHILDREN;
    }

    private KnowledgeBaseParentFilter parentFilter(String parentId, KnowledgeBaseScope scope) {
        boolean hasParent = StringUtils.hasText(parentId);
        if (scope == KnowledgeBaseScope.DESCENDANTS) {
            return hasParent
                    ? KnowledgeBaseParentFilter.of(collectFolderIdsInSubtree(parentId))
                    : KnowledgeBaseParentFilter.any();
        }
        return hasParent ? KnowledgeBaseParentFilter.of(List.of(parentId)) : KnowledgeBaseParentFilter.root();
    }

    /**
     * The folder itself plus every folder below it. One read of all folders' (id, parentId) pairs,
     * walked in memory — a subtree's items are then the items whose parent is one of these.
     */
    private List<String> collectFolderIdsInSubtree(String folderId) {
        Map<String, List<String>> childFolderIds = new HashMap<>();
        for (KnowledgeBaseItem folder : repository.findFolderLinks()) {
            if (folder.getParentId() != null) {
                childFolderIds.computeIfAbsent(folder.getParentId(), parent -> new ArrayList<>()).add(folder.getId());
            }
        }

        List<String> folderIds = new ArrayList<>();
        // Guards the walk against a parent cycle in the data.
        Set<String> seen = new HashSet<>();
        Deque<String> queue = new ArrayDeque<>();
        queue.add(folderId);
        while (!queue.isEmpty()) {
            String current = queue.poll();
            if (seen.add(current)) {
                folderIds.add(current);
                queue.addAll(childFolderIds.getOrDefault(current, List.of()));
            }
        }
        return folderIds;
    }

    /**
     * A cursor issued before cursors carried their stream and sort key is a bare item id. It is
     * positioned off the document as it is now, so a client paging across the deploy keeps its
     * place; when the document is gone the id names no position and the cursor is rejected.
     */
    private KnowledgeBaseItemCursor resolveCursor(String rawCursor) {
        if (!StringUtils.hasText(rawCursor)) {
            return null;
        }
        KnowledgeBaseItemCursor tagged = KnowledgeBaseItemCursor.parse(rawCursor);
        if (tagged != null) {
            return tagged;
        }
        return repository.findCursorItem(rawCursor)
                .map(KnowledgeBaseItemCursor::of)
                .orElseThrow(InvalidCursorException::new);
    }

    private KnowledgeBaseItemCursor resolveArticleCursor(String rawCursor) {
        KnowledgeBaseItemCursor cursor = resolveCursor(rawCursor);
        if (cursor != null && cursor.type() != KnowledgeBaseItemType.ARTICLE) {
            throw new InvalidCursorException();
        }
        return cursor;
    }

    private List<String> collectArticleIdsInSubtree(String folderId) {
        List<String> articleIds = new ArrayList<>();
        Deque<String> queue = new ArrayDeque<>();

        // Process the starting level first — folderId may be null (global root scan)
        // and ArrayDeque rejects null elements.
        collectChildren(folderId, queue, articleIds);
        while (!queue.isEmpty()) {
            collectChildren(queue.poll(), queue, articleIds);
        }
        return articleIds;
    }

    private void collectChildren(String parentId, Deque<String> queue, List<String> articleIds) {
        for (KnowledgeBaseItem child : repository.findByParentId(parentId)) {
            if (child.getType() == KnowledgeBaseItemType.ARTICLE) {
                articleIds.add(child.getId());
            } else {
                queue.add(child.getId());
            }
        }
    }

    private void createAssignments(String articleId, AssignmentTargetType targetType, List<String> targetIds) {
        if (targetIds == null || targetIds.isEmpty()) {
            return;
        }
        targetIds.forEach(targetId ->
                assignmentService.assignItem(articleId, AssignmentItemType.KNOWLEDGE_ARTICLE, targetType, targetId));
    }

    private void replaceAssignments(String articleId, AssignmentTargetType targetType, List<String> targetIds) {
        if (targetIds == null) {
            return;
        }
        assignmentService.replaceAssignments(articleId, AssignmentItemType.KNOWLEDGE_ARTICLE, targetType, targetIds);
    }

    private void moveChildren(List<KnowledgeBaseItem> children, String targetFolderId, String currentFolderId) {
        if (targetFolderId != null) {
            if (targetFolderId.equals(currentFolderId)) {
                throw new ValidationException("Cannot move children to the folder being deleted.");
            }
            validateParentIsFolder(targetFolderId);
            if (isDescendantOf(targetFolderId, currentFolderId)) {
                throw new ConflictException(ErrorCode.CONFLICT,
                        "Move target must not be a descendant of the folder being deleted.");
            }
        }
        children.forEach(c -> c.setParentId(targetFolderId));
        repository.saveAll(children);
    }

    /**
     * Archives all articles in subtree (status=ARCHIVED, parentId=null) and hard-deletes
     * all nested sub-folders. Caller is responsible for deleting the root folder itself.
     */
    private void archiveSubtree(String folderId) {
        List<KnowledgeBaseItem> children = repository.findByParentId(folderId);
        List<KnowledgeBaseItem> toArchive = new ArrayList<>();

        for (KnowledgeBaseItem child : children) {
            if (child.getType() == KnowledgeBaseItemType.ARTICLE) {
                child.setStatus(KnowledgeBaseArticleStatus.ARCHIVED);
                child.setParentId(null);
                toArchive.add(child);
            } else {
                archiveSubtree(child.getId());
                repository.deleteById(child.getId());
            }
        }
        if (!toArchive.isEmpty()) {
            repository.saveAll(toArchive);
        }
    }

    private boolean isDescendantOf(String candidateId, String ancestorId) {
        String currentId = candidateId;
        while (currentId != null) {
            KnowledgeBaseItem current = repository.findById(currentId).orElse(null);
            if (current == null) {
                return false;
            }
            String parentId = current.getParentId();
            if (ancestorId.equals(parentId)) {
                return true;
            }
            currentId = parentId;
        }
        return false;
    }

    private PageInfo buildPageInfo(List<KnowledgeBaseItem> pageItems, boolean hasNextPage, boolean hasPreviousPage) {
        String startCursor = pageItems.isEmpty() ? null : KnowledgeBaseCursors.encode(pageItems.getFirst());
        String endCursor = pageItems.isEmpty() ? null : KnowledgeBaseCursors.encode(pageItems.getLast());

        return PageInfo.builder()
                .hasNextPage(hasNextPage)
                .hasPreviousPage(hasPreviousPage)
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
    }

    private List<String> resolveTagFilter(List<String> tagIds) {
        return knowledgeBaseTagService.findItemIdsByTags(tagIds);
    }

    private List<String> resolveItemIdRestriction(KnowledgeBaseFilterCriteria filter) {
        List<String> taggedIds = resolveTagFilter(filter.getTagIds());
        if (filter.getAssignedTo() == null) {
            return taggedIds;
        }
        List<String> assignedIds = assignmentService.findAssignedItemIds(
                AssignmentItemType.KNOWLEDGE_ARTICLE, filter.getAssignedTo());
        if (taggedIds == null) {
            return assignedIds;
        }
        Set<String> tagged = new HashSet<>(taggedIds);
        return assignedIds.stream().filter(tagged::contains).toList();
    }

    private void requireFolderChildrenDestination(FolderChildrenAction action, String moveTargetFolderId) {
        requireChildrenAction(action);
        if (action == FolderChildrenAction.MOVE) {
            Optional.ofNullable(moveTargetFolderId).ifPresent(this::getById);
        }
    }

    private static void requireChildrenAction(FolderChildrenAction action) {
        if (action == null) {
            throw new ValidationException("Folder has children — childrenAction (MOVE or ARCHIVE) is required.");
        }
    }

    private boolean hasFolderChildren(KnowledgeBaseItem item, String id) {
        return item.getType() == KnowledgeBaseItemType.FOLDER && !repository.findByParentId(id).isEmpty();
    }

    private static void requireArchived(KnowledgeBaseItem item, String id) {
        if (item.getStatus() != KnowledgeBaseArticleStatus.ARCHIVED) {
            throw new ConflictException(ErrorCode.CONFLICT, "Item is not archived: " + id);
        }
    }

    private void addTags(String articleId, List<String> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) {
            return;
        }
        tagIds.forEach(tagId -> knowledgeBaseTagService.addTagToItem(articleId, tagId));
    }

    @Getter
    @Builder
    private static final class KnowledgeBaseItemListing {

        private final KnowledgeBaseParentFilter parent;
        private final String search;
        private final List<String> itemIds;
        private final List<KnowledgeBaseArticleStatus> statuses;
        private final boolean withFolders;
        private final boolean withArticles;
        private final long folderCount;
        private final long articleCount;
    }
}
