package com.openframe.test.tests;

import com.openframe.test.api.KnowledgeBaseApi;
import com.openframe.test.data.dto.knowledgebase.*;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.openframe.test.data.generator.KnowledgeBaseGenerator.*;
import static org.assertj.core.api.AssertionsForInterfaceTypes.assertThat;

@Disabled
@DisplayName("Knowledge Base")
public class KnowledgeBaseTest extends BaseTest {

    @Tag("saas")
    @Tag("read")
    @Test
    @DisplayName("Get root folders")
    public void testGetRootFolders() {
        List<KnowledgeBaseItem> folders = KnowledgeBaseApi.getKnowledgeBaseItems(rootFoldersFilter(), null, 100);

        assertThat(folders).as("Expected at least one root folder").isNotEmpty();
        assertThat(folders).allSatisfy(folder -> {
            assertThat(folder.getId()).as("Folder id should not be blank").isNotBlank();
            assertThat(folder.getName()).as("Folder name should not be blank for " + folder.getId()).isNotBlank();
            assertThat(folder.getType()).as("Folder type should be FOLDER for " + folder.getId()).isEqualTo(KnowledgeBaseItemType.FOLDER);
            assertThat(folder.getParentId()).as("Root folder parentId should be null for " + folder.getId()).isNull();
            assertThat(folder.getCreatedAt()).as("Folder createdAt should not be blank for " + folder.getId()).isNotBlank();
            assertThat(folder.getUpdatedAt()).as("Folder updatedAt should not be blank for " + folder.getId()).isNotBlank();
        });
    }

    @Tag("saas")
    @Tag("read")
    @Test
    @DisplayName("Get articles in folder")
    public void testGetArticlesInFolder() {
        List<KnowledgeBaseItem> folders = KnowledgeBaseApi.getKnowledgeBaseItems(rootFoldersFilter(), null, 100);
        assertThat(folders).as("Expected at least one root folder").isNotEmpty();

        KnowledgeBaseItem folderWithArticles = null;
        List<KnowledgeBaseItem> articles = List.of();
        for (KnowledgeBaseItem folder : folders) {
            articles = KnowledgeBaseApi.getKnowledgeBaseItems(articlesInFolderFilter(folder.getId()), null, 20);
            if (!articles.isEmpty()) {
                folderWithArticles = folder;
                break;
            }
        }
        assertThat(folderWithArticles).as("Expected at least one folder containing articles").isNotNull();

        final String folderId = folderWithArticles.getId();
        assertThat(articles).allSatisfy(article -> {
            assertThat(article.getId()).as("Article id should not be blank").isNotBlank();
            assertThat(article.getName()).as("Article name should not be blank for " + article.getId()).isNotBlank();
            assertThat(article.getType()).as("Article type should be ARTICLE for " + article.getId()).isEqualTo(KnowledgeBaseItemType.ARTICLE);
            assertThat(article.getParentId()).as("Article parentId should match folder " + folderId).isEqualTo(folderId);
            assertThat(article.getStatus()).as("Article status should not be null for " + article.getId()).isNotNull();
            assertThat(article.getCreatedAt()).as("Article createdAt should not be blank for " + article.getId()).isNotBlank();
            assertThat(article.getUpdatedAt()).as("Article updatedAt should not be blank for " + article.getId()).isNotBlank();
        });

        int filteredCount = KnowledgeBaseApi.getKnowledgeBaseItemsFilteredCount(articlesInFolderFilter(folderId), null, 20);
        assertThat(filteredCount).as("filteredCount should match number of articles returned").isEqualTo(articles.size());
    }

    @Tag("saas")
    @Tag("read")
    @Test
    @DisplayName("Get all knowledge base tags")
    public void testGetAllTags() {
        List<KnowledgeBaseTag> tags = KnowledgeBaseApi.getKnowledgeBaseTags(null);

        assertThat(tags).as("Expected at least one knowledge base tag").isNotEmpty();
        assertThat(tags).allSatisfy(tag -> {
            assertThat(tag.getId()).as("Tag id should not be blank").isNotBlank();
            assertThat(tag.getKey()).as("Tag key should not be blank for " + tag.getId()).isNotBlank();
        });
    }

    @Tag("saas")
    @Test
    @DisplayName("Create draft article")
    public void testCreateDraftArticle() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.createFolder(randomFolderName(), null);

        List<KnowledgeBaseTag> tags = KnowledgeBaseApi.getKnowledgeBaseTags(null);
        assertThat(tags).as("Expected at least one tag").isNotEmpty();
        String tagId = tags.getFirst().getId();

        CreateArticleInput input = draftArticle(folder.getId(), List.of(tagId));
        KnowledgeBaseItem created = KnowledgeBaseApi.createArticle(input);

        assertThat(created.getId()).as("Created article id should not be blank").isNotBlank();
        assertThat(created.getType()).as("Created article type should be ARTICLE").isEqualTo(KnowledgeBaseItemType.ARTICLE);
        assertThat(created.getName()).as("Created article name should match input").isEqualTo(input.getName());
        assertThat(created.getParentId()).as("Created article parentId should match input").isEqualTo(folder.getId());
        assertThat(created.getContent()).as("Created article content should match input").isEqualTo(input.getContent());
        assertThat(created.getSummary()).as("Created article summary should match input").isEqualTo(input.getSummary());
        assertThat(created.getStatus()).as("Created article status should be DRAFT").isEqualTo(KnowledgeBaseArticleStatus.DRAFT);
        assertThat(created.getPublishedAt()).as("Draft article publishedAt should be null").isNull();
        assertThat(created.getCreatedAt()).as("Created article createdAt should not be blank").isNotBlank();
        assertThat(created.getUpdatedAt()).as("Created article updatedAt should not be blank").isNotBlank();

        assertThat(created.getAuthor()).as("Created article author should not be null").isNotNull();
        assertThat(created.getAuthor().getId()).as("Author id should not be blank").isNotBlank();
        assertThat(created.getAuthor().getEmail()).as("Author email should not be blank").isNotBlank();

        assertThat(created.getTags()).as("Created article should have tags").isNotEmpty();
        assertThat(created.getTags()).extracting(KnowledgeBaseTag::getId).contains(tagId);
    }

    @Tag("saas")
    @Test
    @DisplayName("Publish draft article")
    public void testPublishArticle() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.createFolder(randomFolderName(), null);
        KnowledgeBaseItem created = KnowledgeBaseApi.createArticle(draftArticle(folder.getId(), List.of()));
        assertThat(created.getStatus()).as("Newly created article should be DRAFT").isEqualTo(KnowledgeBaseArticleStatus.DRAFT);

        KnowledgeBaseItem published = KnowledgeBaseApi.publishArticle(created.getId());

        assertThat(published.getId()).as("Published article id should match created").isEqualTo(created.getId());
        assertThat(published.getStatus()).as("Status should be PUBLISHED after publish").isEqualTo(KnowledgeBaseArticleStatus.PUBLISHED);
        assertThat(published.getUpdatedAt()).as("updatedAt should not be blank after publish").isNotBlank();
    }

    @Tag("saas")
    @Test
    @DisplayName("Update article fields")
    public void testUpdateArticle() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.createFolder(randomFolderName(), null);
        CreateArticleInput input = draftArticle(folder.getId(), List.of());
        KnowledgeBaseItem created = KnowledgeBaseApi.createArticle(input);

        UpdateArticleInput update = UpdateArticleInput.builder()
                .id(created.getId())
                .name(created.getName() + " (edited)")
                .parentId(folder.getId())
                .content(created.getContent() + " — updated content")
                .summary(created.getSummary() + " — updated summary")
                .build();
        KnowledgeBaseItem updated = KnowledgeBaseApi.updateArticle(update);

        assertThat(updated.getId()).as("Updated article id should match").isEqualTo(created.getId());
        assertThat(updated.getName()).as("Updated name should match input").isEqualTo(update.getName());
        assertThat(updated.getParentId()).as("Updated parentId should match input").isEqualTo(folder.getId());
        assertThat(updated.getContent()).as("Updated content should match input").isEqualTo(update.getContent());
        assertThat(updated.getSummary()).as("Updated summary should match input").isEqualTo(update.getSummary());
        assertThat(updated.getUpdatedAt()).as("updatedAt should not be blank after update").isNotBlank();
        assertThat(updated.getUpdatedAt()).as("updatedAt should change after update").isNotEqualTo(created.getUpdatedAt());
    }

    @Tag("saas")
    @Test
    @DisplayName("Create and delete folder")
    public void testCreateAndDeleteFolder() {
        String name = randomFolderName();
        KnowledgeBaseItem folder = KnowledgeBaseApi.createFolder(name, null);

        assertThat(folder.getId()).as("Folder id should not be blank").isNotBlank();
        assertThat(folder.getType()).as("Type should be FOLDER").isEqualTo(KnowledgeBaseItemType.FOLDER);
        assertThat(folder.getName()).as("Name should match").isEqualTo(name);
        assertThat(folder.getParentId()).as("Root folder parentId should be null").isNull();

        boolean deleted = KnowledgeBaseApi.deleteFolder(DeleteFolderInput.builder().id(folder.getId()).build());
        assertThat(deleted).as("deleteFolder should return true").isTrue();
    }

    @Tag("saas")
    @Test
    @DisplayName("Rename folder")
    public void testRenameFolder() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.createFolder(randomFolderName(), null);

        String newName = randomFolderName() + " renamed";
        KnowledgeBaseItem renamed = KnowledgeBaseApi.renameFolder(folder.getId(), newName);

        assertThat(renamed.getId()).as("Renamed folder id should match").isEqualTo(folder.getId());
        assertThat(renamed.getName()).as("Renamed folder name should match input").isEqualTo(newName);
    }

    @Tag("saas")
    @Test
    @DisplayName("Move folder under another folder")
    public void testMoveToFolder() {
        KnowledgeBaseItem parent = KnowledgeBaseApi.createFolder(randomFolderName() + " (parent)", null);
        KnowledgeBaseItem child = KnowledgeBaseApi.createFolder(randomFolderName() + " (child)", null);

        KnowledgeBaseItem moved = KnowledgeBaseApi.moveToFolder(child.getId(), parent.getId());

        assertThat(moved.getId()).as("Moved folder id should match").isEqualTo(child.getId());
        assertThat(moved.getParentId()).as("Moved folder parentId should be new parent").isEqualTo(parent.getId());
    }

    @Tag("saas")
    @Test
    @DisplayName("Get knowledge base item by id")
    public void testGetKnowledgeBaseItemById() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.createFolder(randomFolderName(), null);
        KnowledgeBaseItem article = KnowledgeBaseApi.createArticle(draftArticle(folder.getId(), List.of()));

        KnowledgeBaseItem fetchedFolder = KnowledgeBaseApi.getKnowledgeBaseItem(folder.getId());
        assertThat(fetchedFolder.getId()).as("Fetched folder id should match").isEqualTo(folder.getId());
        assertThat(fetchedFolder.getType()).as("Fetched folder type should be FOLDER").isEqualTo(KnowledgeBaseItemType.FOLDER);
        assertThat(fetchedFolder.getName()).as("Fetched folder name should match").isEqualTo(folder.getName());

        KnowledgeBaseItem fetchedArticle = KnowledgeBaseApi.getKnowledgeBaseItem(article.getId());
        assertThat(fetchedArticle.getId()).as("Fetched article id should match").isEqualTo(article.getId());
        assertThat(fetchedArticle.getType()).as("Fetched article type should be ARTICLE").isEqualTo(KnowledgeBaseItemType.ARTICLE);
        assertThat(fetchedArticle.getName()).as("Fetched article name should match").isEqualTo(article.getName());
        assertThat(fetchedArticle.getParentId()).as("Fetched article parentId should match folder").isEqualTo(folder.getId());
        assertThat(fetchedArticle.getStatus()).as("Fetched article status should be DRAFT").isEqualTo(KnowledgeBaseArticleStatus.DRAFT);
    }

    @Tag("saas")
    @Tag("read")
    @Test
    @DisplayName("Get folder tree")
    public void testGetFolderTree() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.createFolder(randomFolderName(), null);

        List<KnowledgeBaseItem> folderTree = KnowledgeBaseApi.getKnowledgeBaseFolderTree();

        assertThat(folderTree).as("Folder tree should not be empty").isNotEmpty();
        assertThat(folderTree).as("Every node in the folder tree should be FOLDER")
                .allSatisfy(item -> assertThat(item.getType()).isEqualTo(KnowledgeBaseItemType.FOLDER));
        assertThat(folderTree).as("Folder tree should contain the created test folder")
                .extracting(KnowledgeBaseItem::getId).contains(folder.getId());
    }

    @Tag("saas")
    @Tag("read")
    @Test
    @DisplayName("Get article tree")
    public void testGetArticleTree() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.createFolder(randomFolderName(), null);
        KnowledgeBaseItem article = KnowledgeBaseApi.createArticle(draftArticle(folder.getId(), List.of()));

        List<KnowledgeBaseItem> articleTree = KnowledgeBaseApi.getKnowledgeBaseArticleTree();

        assertThat(articleTree).as("Article tree should not be empty").isNotEmpty();
        assertThat(articleTree).as("Every node in the article tree should be ARTICLE")
                .allSatisfy(item -> assertThat(item.getType()).isEqualTo(KnowledgeBaseItemType.ARTICLE));
        assertThat(articleTree).as("Article tree should contain the created article")
                .extracting(KnowledgeBaseItem::getId).contains(article.getId());
    }

    @Tag("saas")
    @Test
    @DisplayName("Add and remove tag on article")
    public void testAddAndRemoveTagOnArticle() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.createFolder(randomFolderName(), null);
        KnowledgeBaseItem article = KnowledgeBaseApi.createArticle(draftArticle(folder.getId(), List.of()));
        assertThat(article.getTags()).as("New article should have no tags initially").isNullOrEmpty();

        List<KnowledgeBaseTag> tags = KnowledgeBaseApi.getKnowledgeBaseTags(null);
        assertThat(tags).as("Expected at least one tag").isNotEmpty();
        String tagId = tags.getFirst().getId();

        KnowledgeBaseItem tagged = KnowledgeBaseApi.addTagToItem(article.getId(), tagId);
        assertThat(tagged.getId()).as("Tagged article id should match").isEqualTo(article.getId());
        assertThat(tagged.getTags()).as("Article should have the added tag")
                .extracting(KnowledgeBaseTag::getId).contains(tagId);

        KnowledgeBaseItem untagged = KnowledgeBaseApi.removeTagFromItem(article.getId(), tagId);
        assertThat(untagged.getId()).as("Untagged article id should match").isEqualTo(article.getId());
        assertThat(untagged.getTags()).as("Article should no longer have the removed tag")
                .extracting(KnowledgeBaseTag::getId).doesNotContain(tagId);
    }

    @Tag("saas")
    @Test
    @DisplayName("Archive and unarchive article")
    public void testArchiveAndUnarchiveArticle() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.createFolder(randomFolderName(), null);
        KnowledgeBaseItem created = KnowledgeBaseApi.createArticle(draftArticle(folder.getId(), List.of()));

        KnowledgeBaseItem archived = KnowledgeBaseApi.archiveArticle(created.getId());
        assertThat(archived.getId()).as("Archived article id should match created").isEqualTo(created.getId());
        assertThat(archived.getStatus()).as("Status should be ARCHIVED after archive").isEqualTo(KnowledgeBaseArticleStatus.ARCHIVED);

        List<KnowledgeBaseItem> archivedList = KnowledgeBaseApi.getArchivedArticles(null, null, 100);
        assertThat(archivedList).as("Archived articles list should contain the archived article")
                .extracting(KnowledgeBaseItem::getId).contains(created.getId());

        KnowledgeBaseItem unarchived = KnowledgeBaseApi.unarchiveArticle(created.getId(), folder.getId());
        assertThat(unarchived.getId()).as("Unarchived article id should match").isEqualTo(created.getId());
        assertThat(unarchived.getStatus()).as("Status should no longer be ARCHIVED after unarchive").isNotEqualTo(KnowledgeBaseArticleStatus.ARCHIVED);
        assertThat(unarchived.getParentId()).as("Unarchive should restore parentId to the supplied folder").isEqualTo(folder.getId());
    }
}
