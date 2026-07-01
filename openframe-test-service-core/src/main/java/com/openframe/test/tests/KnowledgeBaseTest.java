package com.openframe.test.tests;

import com.openframe.test.api.KnowledgeBaseApi;
import com.openframe.test.data.dto.knowledgebase.*;
import org.junit.jupiter.api.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static com.openframe.test.data.generator.KnowledgeBaseGenerator.*;
import static org.assertj.core.api.AssertionsForInterfaceTypes.assertThat;

/**
 * Ordered KB suite. It first creates a folder and a draft article so the read and in-place mutation
 * tests that follow always have data to work with, then exercises reads and mutations against
 * existing data, and finally deletes the created folder. Mutation tests change real data in place
 * (rename / move / publish / archive …).
 */
@DisplayName("Knowledge Base")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class KnowledgeBaseTest extends BaseTest {

    @Tag("saas")
    @Test
    @Order(1)
    @DisplayName("Create folder")
    public void testCreateFolder() {
        final String TEST_FOLDER_NAME = folderName();
        KnowledgeBaseItem folder = KnowledgeBaseApi.createFolder(TEST_FOLDER_NAME, null);

        assertThat(folder.getId()).as("Created folder id should not be blank").isNotBlank();
        assertThat(folder.getType()).as("Created type should be FOLDER").isEqualTo(KnowledgeBaseItemType.FOLDER);
        assertThat(folder.getName()).as("Created folder name should match").isEqualTo(TEST_FOLDER_NAME);
        assertThat(folder.getParentId()).as("Root folder parentId should be null").isNull();
    }

    @Tag("saas")
    @Test
    @Order(2)
    @DisplayName("Create draft article and tag it")
    public void testCreateArticle() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.anyRootFolder();

        // Create the tag up front so it can be attached once the article exists. The key is fixed and
        // createTag is idempotent per (key, entityType), so reruns don't accumulate tags.
//        TagDefinition tag = TagApi.createTag("QA_KB_ARTICLE_TAG", "KNOWLEDGE_ARTICLE", null, null);
//        assertThat(tag.getId()).as("Created tag id should not be blank").isNotBlank();

        CreateArticleInput input = draftArticle(folder.getId());
        KnowledgeBaseItem article = KnowledgeBaseApi.createArticle(input);

        assertThat(article.getId()).as("Created article id should not be blank").isNotBlank();
        assertThat(article.getType()).as("Created article type should be ARTICLE").isEqualTo(KnowledgeBaseItemType.ARTICLE);
        assertThat(article.getName()).as("Created article name should match input").isEqualTo(input.getName());
        assertThat(article.getParentId()).as("Created article parentId should match folder").isEqualTo(folder.getId());
        assertThat(article.getContent()).as("Created article content should match input").isEqualTo(input.getContent());
        assertThat(article.getSummary()).as("Created article summary should match input").isEqualTo(input.getSummary());
        assertThat(article.getStatus()).as("Created article status should be DRAFT").isEqualTo(KnowledgeBaseArticleStatus.DRAFT);
        assertThat(article.getPublishedAt()).as("Draft article publishedAt should be null").isNull();
        assertThat(article.getAuthor()).as("Created article author should not be null").isNotNull();
        assertThat(article.getAuthor().getId()).as("Author id should not be blank").isNotBlank();
        assertThat(article.getAuthor().getEmail()).as("Author email should not be blank").isNotBlank();

        // Attach the tag to the freshly created article (useAddTagMutation).
//        KnowledgeBaseItem tagged = KnowledgeBaseApi.addTagToItem(article.getId(), tag.getId());
//        assertThat(tagged.getId()).as("Tagged article id should match").isEqualTo(article.getId());
//        assertThat(tagged.getTags()).as("Article should have the attached tag")
//                .extracting(KnowledgeBaseTag::getId).contains(tag.getId());
    }

    @Tag("saas")
    @Tag("read")
    @Test
    @Order(3)
    @DisplayName("Get root folders")
    public void testGetRootFolders() {
        List<KnowledgeBaseItem> folders = KnowledgeBaseApi.getKnowledgeBaseItems(rootFoldersFilter(), 100);

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

    @Disabled
    @Tag("saas")
    @Tag("read")
    @Test
    @Order(4)
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
    @Tag("read")
    @Test
    @Order(5)
    @DisplayName("Get folder tree")
    public void testGetFolderTree() {
        KnowledgeBaseItem rootFolder = KnowledgeBaseApi.anyRootFolder();

        List<KnowledgeBaseItem> folderTree = KnowledgeBaseApi.getKnowledgeBaseFolderTree();

        assertThat(folderTree).as("Folder tree should not be empty").isNotEmpty();
        assertThat(folderTree).as("Every node in the folder tree should be FOLDER")
                .allSatisfy(item -> assertThat(item.getType()).isEqualTo(KnowledgeBaseItemType.FOLDER));
        assertThat(folderTree).as("Folder tree should contain an existing root folder")
                .extracting(KnowledgeBaseItem::getId).contains(rootFolder.getId());
    }

    @Tag("saas")
    @Tag("read")
    @Test
    @Order(6)
    @DisplayName("Get article tree")
    public void testGetArticleTree() {
        List<KnowledgeBaseItem> articleTree = KnowledgeBaseApi.getKnowledgeBaseArticleTree();

        assertThat(articleTree).as("Article tree should not be empty").isNotEmpty();
        assertThat(articleTree).as("Every node in the article tree should be ARTICLE")
                .allSatisfy(item -> {
                    assertThat(item.getType()).as("Tree node should be ARTICLE").isEqualTo(KnowledgeBaseItemType.ARTICLE);
                    assertThat(item.getId()).as("Tree node id should not be blank").isNotBlank();
                });
    }

    @Tag("saas")
    @Tag("read")
    @Test
    @Order(7)
    @DisplayName("Get knowledge base item by id")
    public void testGetKnowledgeBaseItemById() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.anyRootFolder();
        KnowledgeBaseItem article = KnowledgeBaseApi.anyArticle();
        assertThat(article).as("Expected an existing article").isNotNull();

        KnowledgeBaseItem fetchedFolder = KnowledgeBaseApi.getKnowledgeBaseItem(folder.getId());
        assertThat(fetchedFolder.getId()).as("Fetched folder id should match").isEqualTo(folder.getId());
        assertThat(fetchedFolder.getType()).as("Fetched folder type should be FOLDER").isEqualTo(KnowledgeBaseItemType.FOLDER);
        assertThat(fetchedFolder.getName()).as("Fetched folder name should match").isEqualTo(folder.getName());

        KnowledgeBaseItem fetchedArticle = KnowledgeBaseApi.getKnowledgeBaseItem(article.getId());
        assertThat(fetchedArticle.getId()).as("Fetched article id should match").isEqualTo(article.getId());
        assertThat(fetchedArticle.getType()).as("Fetched article type should be ARTICLE").isEqualTo(KnowledgeBaseItemType.ARTICLE);
        assertThat(fetchedArticle.getName()).as("Fetched article name should match").isEqualTo(article.getName());
    }

    @Tag("saas")
    @Test
    @Order(8)
    @DisplayName("Create attachment upload url")
    public void testCreateAttachmentUploadUrl() {
        // Create an attachment against an existing article. The mutation returns the attachment
        // metadata (with its id) plus a presigned upload URL; no bytes need to be uploaded. This
        // attaches the attachment to the article, so the download-url query test can discover it.
        KnowledgeBaseItem article = KnowledgeBaseApi.anyArticle();
        assertThat(article).as("Expected an existing article").isNotNull();

        CreateKnowledgeBaseAttachmentInput input = attachmentInput(article.getId());
        KnowledgeBaseAttachmentUploadPayload upload = KnowledgeBaseApi.createAttachmentUploadUrl(input);

        assertThat(upload).as("Upload payload should not be null").isNotNull();
        // Schema types userErrors as [MutationError!]! so a successful mutation yields an empty list, not null.
        assertThat(upload.getUserErrors()).as("Successful upload should have no userErrors").isNullOrEmpty();
        assertThat(upload.getUploadUrl()).as("Upload URL should not be blank").isNotBlank();

        KnowledgeBaseItemAttachment attachment = upload.getAttachment();
        assertThat(attachment).as("Created attachment should not be null").isNotNull();
        assertThat(attachment.getId()).as("Created attachment id should not be blank").isNotBlank();
        assertThat(attachment.getFileName()).as("Attachment fileName should match input").isEqualTo(input.getFileName());
        assertThat(attachment.getContentType()).as("Attachment contentType should match input").isEqualTo(input.getContentType());
        assertThat(attachment.getFileSize()).as("Attachment fileSize should match input").isEqualTo(input.getFileSize());
        LocalDate createdDate = Instant.parse(attachment.getCreatedAt()).atZone(ZoneOffset.UTC).toLocalDate();
        assertThat(createdDate).as("Attachment createdAt should be today (UTC)").isEqualTo(LocalDate.now(ZoneOffset.UTC));
    }

    @Tag("saas")
    @Tag("read")
    @Test
    @Order(9)
    @DisplayName("Get attachment download url")
    public void testGetAttachmentDownloadUrl() {
        // An attachment is attached to an article, so discover an article that has one and take its
        // attachment id from the article itself (testCreateAttachmentUploadUrl at Order(8) creates one).
        KnowledgeBaseItem article = KnowledgeBaseApi.anyArticleWithAttachment();
        KnowledgeBaseItemAttachment attachment = article.getAttachments().getFirst();
        assertThat(attachment.getId()).as("Discovered attachment id should not be blank").isNotBlank();
        assertThat(attachment.getFileName()).as("Discovered attachment fileName should not be blank").isNotBlank();

        String downloadUrl = KnowledgeBaseApi.getAttachmentDownloadUrl(attachment.getId());

        //TODO: download
        assertThat(downloadUrl).as("Attachment download url should not be blank").isNotBlank();
        assertThat(downloadUrl).as("Attachment download url should be an http(s) URL").startsWith("http");
    }

    @Tag("saas")
    @Test
    @Order(10)
    @DisplayName("Rename existing folder")
    public void testRenameFolder() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.anyRootFolder();

        String newName = randomFolderName() + " renamed";
        KnowledgeBaseItem renamed = KnowledgeBaseApi.renameFolder(folder.getId(), newName);

        assertThat(renamed.getId()).as("Renamed folder id should match").isEqualTo(folder.getId());
        assertThat(renamed.getName()).as("Renamed folder name should match input").isEqualTo(newName);
    }

    @Tag("saas")
    @Test
    @Order(11)
    @DisplayName("Move existing folder under another folder")
    public void testMoveToFolder() {
        // Create the parent and child up front so the move never depends on the env already having
        // two root folders.
        KnowledgeBaseItem parent = KnowledgeBaseApi.createFolder(folderName(), null);
        KnowledgeBaseItem child = KnowledgeBaseApi.createFolder(folderName(), null);

        KnowledgeBaseItem moved = KnowledgeBaseApi.moveToFolder(child.getId(), parent.getId());

        assertThat(moved.getId()).as("Moved folder id should match").isEqualTo(child.getId());
        assertThat(moved.getParentId()).as("Moved folder parentId should be the new parent").isEqualTo(parent.getId());
    }

    @Tag("saas")
    @Test
    @Order(12)
    @DisplayName("Update existing article fields")
    public void testUpdateArticle() {
        KnowledgeBaseItem any = KnowledgeBaseApi.anyArticle();
        assertThat(any).as("Expected an existing article").isNotNull();
        KnowledgeBaseItem article = KnowledgeBaseApi.getKnowledgeBaseItem(any.getId());

        UpdateArticleInput update = updateArticleRequest(article);
        KnowledgeBaseItem updated = KnowledgeBaseApi.updateArticle(update);

        assertThat(updated.getId()).as("Updated article id should match").isEqualTo(article.getId());
        assertThat(updated.getName()).as("Updated name should match input").isEqualTo(update.getName());
        assertThat(updated.getParentId()).as("Updated parentId should match input").isEqualTo(article.getParentId());
        assertThat(updated.getContent()).as("Updated content should match input").isEqualTo(update.getContent());
        assertThat(updated.getSummary()).as("Updated summary should match input").isEqualTo(update.getSummary());
        assertThat(updated.getUpdatedAt()).as("updatedAt should not be blank after update").isNotBlank();
        assertThat(updated.getUpdatedAt()).as("updatedAt should change after update").isNotEqualTo(article.getUpdatedAt());
    }

    @Tag("saas")
    @Test
    @Order(13)
    @DisplayName("Publish an existing draft article")
    public void testPublishArticle() {
        KnowledgeBaseItem draft = KnowledgeBaseApi.anyDraftArticle();

        KnowledgeBaseItem published = KnowledgeBaseApi.publishArticle(draft.getId());

        assertThat(published.getId()).as("Published article id should match").isEqualTo(draft.getId());
        assertThat(published.getStatus()).as("Status should be PUBLISHED after publish").isEqualTo(KnowledgeBaseArticleStatus.PUBLISHED);
        assertThat(published.getUpdatedAt()).as("updatedAt should not be blank after publish").isNotBlank();
    }

    @Tag("saas")
    @Test
    @Order(14)
    @DisplayName("Archive an existing article")
    public void testArchiveArticle() {
        KnowledgeBaseItem article = KnowledgeBaseApi.anyArticle();
        assertThat(article).as("Expected an existing article").isNotNull();

        KnowledgeBaseItem archived = KnowledgeBaseApi.archiveArticle(article.getId());
        assertThat(archived.getId()).as("Archived article id should match").isEqualTo(article.getId());
        assertThat(archived.getStatus()).as("Status should be ARCHIVED after archive").isEqualTo(KnowledgeBaseArticleStatus.ARCHIVED);

        List<KnowledgeBaseItem> archivedList = KnowledgeBaseApi.getArchivedArticles(100);
        assertThat(archivedList).as("Archived articles list should contain the archived article")
                .extracting(KnowledgeBaseItem::getId).contains(article.getId());
    }

    @Tag("saas")
    @Test
    @Order(15)
    @DisplayName("Unarchive an existing archived article")
    public void testUnarchiveArticle() {
        List<KnowledgeBaseItem> archivedList = KnowledgeBaseApi.getArchivedArticles(1);
        assertThat(archivedList).as("Expected at least one archived article to unarchive").isNotEmpty();
        KnowledgeBaseItem archived = archivedList.getFirst();
        KnowledgeBaseItem targetFolder = KnowledgeBaseApi.anyRootFolder();

        KnowledgeBaseItem unarchived = KnowledgeBaseApi.unarchiveArticle(archived.getId(), targetFolder.getId());

        assertThat(unarchived.getId()).as("Unarchived article id should match").isEqualTo(archived.getId());
        assertThat(unarchived.getStatus()).as("Status should no longer be ARCHIVED after unarchive").isNotEqualTo(KnowledgeBaseArticleStatus.ARCHIVED);
        assertThat(unarchived.getParentId()).as("Unarchive should restore parentId to the supplied folder").isEqualTo(targetFolder.getId());
    }

    @Tag("saas")
    @Test
    @Order(16)
    @DisplayName("Delete folder (archiving its article)")
    public void testDeleteFolder() {
        KnowledgeBaseItem folder = KnowledgeBaseApi.anyRootFolder();

        boolean deleted = KnowledgeBaseApi.deleteFolder(deleteFolderArchivingChildren(folder.getId()));
        assertThat(deleted).as("deleteFolder should return true").isTrue();
    }
}
