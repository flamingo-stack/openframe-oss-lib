package com.openframe.api.service;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.knowledgebase.CreateArticleCommand;
import com.openframe.api.dto.knowledgebase.FolderChildrenAction;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.knowledgebase.PagedArticles;
import com.openframe.api.dto.knowledgebase.UpdateArticleCommand;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
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

    public CountedGenericQueryResult<KnowledgeBaseItem> queryItems(
            String currentUserId, KnowledgeBaseFilterCriteria filter, String search,
            CursorPaginationCriteria paginationCriteria) {
        log.debug("Querying KB items for user {}: filter={}, search={}", currentUserId, filter, search);

        CursorPaginationCriteria normalized = paginationCriteria.normalize();

        boolean recursive = StringUtils.hasText(filter.getParentId())
                && filter.getTagIds() != null && !filter.getTagIds().isEmpty();
        if (recursive) {
            return queryArticlesInSubtree(currentUserId, filter, search, normalized);
        }

        List<String> restrictToItemIds = resolveTagFilter(filter.getTagIds());

        if (filter.getType() == KnowledgeBaseItemType.FOLDER) {
            return queryFoldersOnly(filter, search, restrictToItemIds, normalized);
        }
        if (filter.getType() == KnowledgeBaseItemType.ARTICLE) {
            return queryArticlesOnly(currentUserId, filter, search, restrictToItemIds, normalized);
        }
        return queryMixed(currentUserId, filter, search, restrictToItemIds, normalized);
    }

    public Optional<KnowledgeBaseItem> getItem(String id) {
        return repository.findById(id);
    }

    public List<Tag> getTagsInSubtree(String folderId) {
        List<String> articleIds = collectArticleIdsInSubtree(folderId);
        return articleIds.isEmpty()
                ? List.of()
                : knowledgeBaseTagService.getTagsForItemIds(articleIds);
    }

    public CountedGenericQueryResult<KnowledgeBaseItem> queryArchivedArticles(
            String currentUserId, String search, List<String> tagIds,
            CursorPaginationCriteria paginationCriteria) {
        log.debug("Querying archived KB articles for user {}: search={}, tagIds={}",
                currentUserId, search, tagIds);
        CursorPaginationCriteria normalized = paginationCriteria.normalize();

        List<String> restrictToItemIds = resolveTagFilter(tagIds);

        long filteredCount = repository.countArchivedArticles(currentUserId, search, restrictToItemIds);
        PagedArticles paged = fetchArchivedArticlesPage(currentUserId, search, restrictToItemIds, normalized);

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
            throw new IllegalStateException("Only folders can be deleted via deleteFolder. Use archiveArticle for articles.");
        }

        List<KnowledgeBaseItem> children = repository.findByParentId(id);

        if (!children.isEmpty()) {
            if (action == null) {
                throw new IllegalArgumentException(
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
            throw new IllegalStateException("Only articles can be published.");
        }
        article.setStatus(KnowledgeBaseArticleStatus.PUBLISHED);
        return repository.save(article);
    }

    @Transactional
    public KnowledgeBaseItem unpublishArticle(String id) {
        log.info("Unpublishing article {}", id);
        KnowledgeBaseItem article = getById(id);
        if (article.getType() != KnowledgeBaseItemType.ARTICLE) {
            throw new IllegalStateException("Only articles can be unpublished.");
        }
        article.setStatus(KnowledgeBaseArticleStatus.DRAFT);
        return repository.save(article);
    }

    @Transactional
    public KnowledgeBaseItem archiveArticle(String id) {
        log.info("Archiving article {}", id);
        KnowledgeBaseItem item = getById(id);
        if (item.getType() != KnowledgeBaseItemType.ARTICLE) {
            throw new IllegalStateException("Only articles can be archived. Folders must be deleted via deleteFolder.");
        }
        item.setStatus(KnowledgeBaseArticleStatus.ARCHIVED);
        return repository.save(item);
    }

    @Transactional
    public KnowledgeBaseItem unarchiveArticle(String id, String parentId) {
        log.info("Unarchiving article {} into folder {}", id, parentId);
        KnowledgeBaseItem item = getById(id);
        if (item.getType() != KnowledgeBaseItemType.ARTICLE) {
            throw new IllegalStateException("Only articles can be unarchived.");
        }
        if (item.getStatus() != KnowledgeBaseArticleStatus.ARCHIVED) {
            throw new IllegalStateException("Item is not archived: " + id);
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
                throw new IllegalArgumentException("Cannot move item to itself.");
            }
            validateParentIsFolder(parentId);
            if (item.getType() == KnowledgeBaseItemType.FOLDER && isDescendantOf(parentId, id)) {
                throw new IllegalArgumentException("Cannot move folder into its own descendant.");
            }
        }

        item.setParentId(parentId);
        return repository.save(item);
    }

    private CountedGenericQueryResult<KnowledgeBaseItem> queryMixed(
            String currentUserId, KnowledgeBaseFilterCriteria filter, String search,
            List<String> restrictToItemIds, CursorPaginationCriteria normalized) {
        boolean isFirstPage = !normalized.hasCursor();

        List<KnowledgeBaseItem> allFolders = repository.findFoldersForParent(
                filter.getParentId(), search, restrictToItemIds);
        long articleCount = repository.countArticles(
                currentUserId, filter.getParentId(), search,
                KnowledgeBaseItemType.ARTICLE, restrictToItemIds);
        long totalCount = allFolders.size() + articleCount;

        List<KnowledgeBaseItem> displayedFolders = isFirstPage ? allFolders : List.of();
        int articleLimit = Math.max(0, normalized.getLimit() - displayedFolders.size());
        PagedArticles paged = articleLimit > 0
                ? fetchArticlesPage(currentUserId, filter.getParentId(), search,
                        restrictToItemIds, normalized.getCursor(), articleLimit)
                : new PagedArticles(List.of(), false);

        List<KnowledgeBaseItem> combined = Stream.concat(displayedFolders.stream(), paged.items().stream()).toList();
        PageInfo pageInfo = buildPageInfo(combined, paged.hasNextPage(), normalized.hasCursor());

        return CountedGenericQueryResult.<KnowledgeBaseItem>builder()
                .items(combined)
                .pageInfo(pageInfo)
                .filteredCount((int) totalCount)
                .build();
    }

    private CountedGenericQueryResult<KnowledgeBaseItem> queryFoldersOnly(
            KnowledgeBaseFilterCriteria filter, String search,
            List<String> restrictToItemIds, CursorPaginationCriteria normalized) {
        List<KnowledgeBaseItem> folders = repository.findFoldersForParent(
                filter.getParentId(), search, restrictToItemIds);
        PageInfo pageInfo = buildPageInfo(folders, false, normalized.hasCursor());

        return CountedGenericQueryResult.<KnowledgeBaseItem>builder()
                .items(folders)
                .pageInfo(pageInfo)
                .filteredCount(folders.size())
                .build();
    }

    private CountedGenericQueryResult<KnowledgeBaseItem> queryArticlesOnly(
            String currentUserId, KnowledgeBaseFilterCriteria filter, String search,
            List<String> restrictToItemIds, CursorPaginationCriteria normalized) {
        long count = repository.countArticles(
                currentUserId, filter.getParentId(), search,
                KnowledgeBaseItemType.ARTICLE, restrictToItemIds);
        PagedArticles paged = fetchArticlesPage(currentUserId, filter.getParentId(),
                search, restrictToItemIds, normalized.getCursor(), normalized.getLimit());

        PageInfo pageInfo = buildPageInfo(paged.items(), paged.hasNextPage(), normalized.hasCursor());

        return CountedGenericQueryResult.<KnowledgeBaseItem>builder()
                .items(paged.items())
                .pageInfo(pageInfo)
                .filteredCount((int) count)
                .build();
    }

    private CountedGenericQueryResult<KnowledgeBaseItem> queryArticlesInSubtree(
            String currentUserId, KnowledgeBaseFilterCriteria filter, String search,
            CursorPaginationCriteria normalized) {
        List<String> tagFilteredIds = resolveTagFilter(filter.getTagIds());
        if (tagFilteredIds == null || tagFilteredIds.isEmpty()) {
            return buildEmptyResult(normalized);
        }

        Set<String> subtreeArticleIds = new HashSet<>(collectArticleIdsInSubtree(filter.getParentId()));
        List<String> intersection = tagFilteredIds.stream()
                .filter(subtreeArticleIds::contains)
                .toList();
        if (intersection.isEmpty()) {
            return buildEmptyResult(normalized);
        }
        long count = repository.countArticles(
                currentUserId, null, search, KnowledgeBaseItemType.ARTICLE, intersection);
        PagedArticles paged = fetchArticlesPage(currentUserId, null, search,
                intersection, normalized.getCursor(), normalized.getLimit());

        PageInfo pageInfo = buildPageInfo(paged.items(), paged.hasNextPage(), normalized.hasCursor());

        return CountedGenericQueryResult.<KnowledgeBaseItem>builder()
                .items(paged.items())
                .pageInfo(pageInfo)
                .filteredCount((int) count)
                .build();
    }

    private PagedArticles fetchArticlesPage(String currentUserId, String parentId, String search,
                                             List<String> itemIds, String cursor, int limit) {
        List<KnowledgeBaseItem> raw = repository.findArticles(
                currentUserId, parentId, search, KnowledgeBaseItemType.ARTICLE, itemIds, cursor, limit + 1);
        boolean hasNextPage = raw.size() > limit;
        List<KnowledgeBaseItem> page = hasNextPage ? raw.subList(0, limit) : raw;
        return new PagedArticles(page, hasNextPage);
    }

    private PagedArticles fetchArchivedArticlesPage(String currentUserId, String search,
                                                      List<String> itemIds,
                                                      CursorPaginationCriteria normalized) {
        int limit = normalized.getLimit();
        List<KnowledgeBaseItem> raw = repository.findArchivedArticles(
                currentUserId, search, itemIds, normalized.getCursor(), limit + 1);
        boolean hasNextPage = raw.size() > limit;
        List<KnowledgeBaseItem> page = hasNextPage ? raw.subList(0, limit) : raw;
        return new PagedArticles(page, hasNextPage);
    }

    private CountedGenericQueryResult<KnowledgeBaseItem> buildEmptyResult(CursorPaginationCriteria normalized) {
        PageInfo pageInfo = buildPageInfo(List.of(), false, normalized.hasCursor());
        return CountedGenericQueryResult.<KnowledgeBaseItem>builder()
                .items(List.of())
                .pageInfo(pageInfo)
                .filteredCount(0)
                .build();
    }

    private List<String> collectArticleIdsInSubtree(String folderId) {
        List<String> articleIds = new ArrayList<>();
        Deque<String> queue = new ArrayDeque<>();
        queue.add(folderId);
        while (!queue.isEmpty()) {
            List<KnowledgeBaseItem> children = repository.findByParentId(queue.poll());
            for (KnowledgeBaseItem child : children) {
                if (child.getType() == KnowledgeBaseItemType.ARTICLE) {
                    articleIds.add(child.getId());
                } else {
                    queue.add(child.getId());
                }
            }
        }
        return articleIds;
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
                throw new IllegalArgumentException("Cannot move children to the folder being deleted.");
            }
            validateParentIsFolder(targetFolderId);
            if (isDescendantOf(targetFolderId, currentFolderId)) {
                throw new IllegalArgumentException(
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
                .orElseThrow(() -> new IllegalArgumentException("Parent folder not found: " + parentId));
        if (parent.getType() != KnowledgeBaseItemType.FOLDER) {
            throw new IllegalStateException("Parent must be a folder: " + parentId);
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
        String startCursor = pageItems.isEmpty() ? null : CursorCodec.encode(pageItems.getFirst().getId());
        String endCursor = pageItems.isEmpty() ? null : CursorCodec.encode(pageItems.getLast().getId());

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
                .orElseThrow(() -> new IllegalArgumentException("Knowledge base item not found: " + id));
    }

    private void addTags(String articleId, List<String> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) {
            return;
        }
        tagIds.forEach(tagId -> knowledgeBaseTagService.addTagToItem(articleId, tagId));
    }
}
