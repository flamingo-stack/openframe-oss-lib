package com.openframe.api.service.knowledgebase;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.knowledgebase.CreateArticleCommand;
import com.openframe.api.dto.knowledgebase.FolderChildrenAction;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseCursors;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseScope;
import com.openframe.api.dto.knowledgebase.PagedArticles;
import com.openframe.api.dto.knowledgebase.UpdateArticleCommand;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.service.AssignmentService;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemCursor;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseParentFilter;
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
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

@Service
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class KnowledgeBaseService {

    private final KnowledgeBaseItemRepository repository;
    private final KnowledgeBaseTagService knowledgeBaseTagService;
    private final AssignmentService assignmentService;

    /**
     * One page of a listing: folders first (by name), then articles (most recently updated first),
     * both paged in the database. The cursor says which of the two streams the page continues.
     */
    public CountedGenericQueryResult<KnowledgeBaseItem> queryItems(
            KnowledgeBaseFilterCriteria filter, String search,
            CursorPaginationCriteria paginationCriteria) {
        log.debug("Querying KB items: filter={}, search={}", filter, search);

        CursorPaginationCriteria normalized = paginationCriteria.normalize();
        int limit = normalized.getLimit();

        List<String> restrictToItemIds = resolveTagFilter(filter.getTagIds());
        boolean wantsFolders = filter.getType() != KnowledgeBaseItemType.ARTICLE;
        boolean wantsArticles = filter.getType() != KnowledgeBaseItemType.FOLDER;
        // Folders and articles always read from the same parents: a search that reaches three
        // levels down for articles reaches three levels down for folders too.
        KnowledgeBaseParentFilter parent = parentFilter(
                filter.getParentId(), effectiveScope(filter, search, restrictToItemIds != null));

        // A folder cursor continues the folder stream; an article cursor means the folders have
        // already been served.
        KnowledgeBaseItemCursor cursor = resolveCursor(normalized.getCursor());
        boolean pastFolders = cursor != null && cursor.type() == KnowledgeBaseItemType.ARTICLE;

        List<KnowledgeBaseItem> folders = List.of();
        long folderCount = 0;
        boolean hasNextPage = false;
        if (wantsFolders) {
            folderCount = repository.countFolders(parent, search, restrictToItemIds);
            if (!pastFolders) {
                List<KnowledgeBaseItem> raw = repository.findFolders(
                        parent, search, restrictToItemIds, cursor, limit + 1);
                hasNextPage = raw.size() > limit;
                folders = hasNextPage ? raw.subList(0, limit) : raw;
            }
        }

        List<KnowledgeBaseItem> articles = List.of();
        long articleCount = 0;
        if (wantsArticles) {
            articleCount = repository.countArticles(
                    parent, search, restrictToItemIds, filter.getStatuses());
            int articleLimit = limit - folders.size();
            if (articleLimit > 0) {
                PagedArticles paged = fetchArticlesPage(parent, search, restrictToItemIds,
                        filter.getStatuses(), pastFolders ? cursor : null, articleLimit);
                articles = paged.items();
                hasNextPage = paged.hasNextPage();
            } else if (!hasNextPage) {
                // A page filled by folders alone still has a next page when articles follow them.
                hasNextPage = articleCount > 0;
            }
        }

        List<KnowledgeBaseItem> combined = Stream.concat(folders.stream(), articles.stream()).toList();
        PageInfo pageInfo = buildPageInfo(combined, hasNextPage, normalized.hasCursor());

        return CountedGenericQueryResult.<KnowledgeBaseItem>builder()
                .items(combined)
                .pageInfo(pageInfo)
                .filteredCount((int) (folderCount + articleCount))
                .build();
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
        List<String> articleIds = collectArticleIdsInSubtree(folderId);
        return articleIds.isEmpty()
                ? List.of()
                : knowledgeBaseTagService.getTagsForItemIds(articleIds);
    }

    public CountedGenericQueryResult<KnowledgeBaseItem> queryArchivedArticles(
            String search, List<String> tagIds,
            CursorPaginationCriteria paginationCriteria) {
        log.debug("Querying archived KB articles: search={}, tagIds={}", search, tagIds);
        CursorPaginationCriteria normalized = paginationCriteria.normalize();

        List<String> restrictToItemIds = resolveTagFilter(tagIds);

        long filteredCount = repository.countArchivedArticles(search, restrictToItemIds);
        PagedArticles paged = fetchArchivedArticlesPage(search, restrictToItemIds, normalized);

        PageInfo pageInfo = buildPageInfo(paged.items(), paged.hasNextPage(), normalized.hasCursor());

        return CountedGenericQueryResult.<KnowledgeBaseItem>builder()
                .items(paged.items())
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
            if (action == null) {
                throw new ValidationException(
                        "Folder has children — childrenAction (MOVE or ARCHIVE) is required.");
            }
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

        addTags(saved.getId(), cmd.getTagIds());
        createAssignments(saved.getId(), AssignmentTargetType.ORGANIZATION, cmd.getAssignedOrganizationIds());
        createAssignments(saved.getId(), AssignmentTargetType.DEVICE, cmd.getAssignedDeviceIds());
        createAssignments(saved.getId(), AssignmentTargetType.TICKET, cmd.getAssignedTicketIds());
        createAssignments(saved.getId(), AssignmentTargetType.KNOWLEDGE_ARTICLE, cmd.getAssignedKnowledgeArticleIds());

        return saved;
    }

    @Transactional
    public KnowledgeBaseItem updateArticle(String currentUserId, UpdateArticleCommand cmd) {
        log.info("Updating article {} by user {}", cmd.getId(), currentUserId);
        KnowledgeBaseItem article = getById(cmd.getId());
        if (cmd.getName() != null) {
            article.setName(cmd.getName());
        }
        if (cmd.getParentId() != null) {
            validateParentIsFolder(cmd.getParentId());
            article.setParentId(cmd.getParentId());
        }
        if (cmd.getContent() != null) {
            article.setContent(cmd.getContent());
        }
        if (cmd.getSummary() != null) {
            article.setSummary(cmd.getSummary());
        }
        article.setLastModifiedBy(currentUserId);
        return repository.save(article);
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
        if (item.getStatus() != KnowledgeBaseArticleStatus.ARCHIVED) {
            throw new ConflictException(ErrorCode.CONFLICT, "Item is not archived: " + id);
        }
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
     * positioned the way it always was — off the document as it is now, or by the id alone when
     * the document is gone — so a client paging across the deploy keeps its place.
     */
    private KnowledgeBaseItemCursor resolveCursor(String rawCursor) {
        if (!StringUtils.hasText(rawCursor)) {
            return null;
        }
        KnowledgeBaseItemCursor tagged = KnowledgeBaseItemCursor.parse(rawCursor);
        if (tagged != null) {
            return tagged;
        }
        return repository.findById(rawCursor)
                .map(KnowledgeBaseItemCursor::of)
                .orElseGet(() -> new KnowledgeBaseItemCursor(KnowledgeBaseItemType.ARTICLE, rawCursor, null, null));
    }

    private PagedArticles fetchArticlesPage(KnowledgeBaseParentFilter parent, String search,
                                             List<String> itemIds,
                                             List<KnowledgeBaseArticleStatus> statuses,
                                             KnowledgeBaseItemCursor cursor, int limit) {
        List<KnowledgeBaseItem> raw = repository.findArticles(
                parent, search, itemIds, statuses, cursor, limit + 1);
        boolean hasNextPage = raw.size() > limit;
        List<KnowledgeBaseItem> page = hasNextPage ? raw.subList(0, limit) : raw;
        return new PagedArticles(page, hasNextPage);
    }

    private PagedArticles fetchArchivedArticlesPage(String search,
                                                      List<String> itemIds,
                                                      CursorPaginationCriteria normalized) {
        int limit = normalized.getLimit();
        List<KnowledgeBaseItem> raw = repository.findArchivedArticles(
                search, itemIds, resolveCursor(normalized.getCursor()), limit + 1);
        boolean hasNextPage = raw.size() > limit;
        List<KnowledgeBaseItem> page = hasNextPage ? raw.subList(0, limit) : raw;
        return new PagedArticles(page, hasNextPage);
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

    private void validateParentIsFolder(String parentId) {
        if (parentId == null) {
            return;
        }
        KnowledgeBaseItem parent = repository.findById(parentId)
                .orElseThrow(() -> new NotFoundException(ErrorCode.KNOWLEDGE_BASE_ITEM_NOT_FOUND, "Parent folder not found: " + parentId));
        if (parent.getType() != KnowledgeBaseItemType.FOLDER) {
            throw new ConflictException(ErrorCode.CONFLICT, "Parent must be a folder: " + parentId);
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

    private KnowledgeBaseItem getById(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException(ErrorCode.KNOWLEDGE_BASE_ITEM_NOT_FOUND, "Knowledge base item not found: " + id));
    }

    private void addTags(String articleId, List<String> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) {
            return;
        }
        tagIds.forEach(tagId -> knowledgeBaseTagService.addTagToItem(articleId, tagId));
    }
}
