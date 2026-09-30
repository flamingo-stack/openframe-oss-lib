package com.openframe.test.tests.external;

import com.openframe.test.api.AttachmentApi;
import com.openframe.test.api.TagApi;
import com.openframe.test.api.external.ExternalKnowledgeBaseApi;
import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import com.openframe.test.data.dto.external.knowledgebase.CreateArticleRequest;
import com.openframe.test.data.dto.external.knowledgebase.CreateFolderRequest;
import com.openframe.test.data.dto.external.knowledgebase.CreateKnowledgeBaseAttachmentRequest;
import com.openframe.test.data.dto.external.knowledgebase.KnowledgeBaseAttachmentResponse;
import com.openframe.test.data.dto.external.knowledgebase.KnowledgeBaseAttachmentUploadResponse;
import com.openframe.test.data.dto.external.knowledgebase.KnowledgeBaseItemResponse;
import com.openframe.test.data.dto.external.knowledgebase.KnowledgeBaseItemsResponse;
import com.openframe.test.data.dto.external.knowledgebase.KnowledgeBaseTagResponse;
import com.openframe.test.data.dto.external.knowledgebase.UpdateArticleRequest;
import com.openframe.test.data.dto.knowledgebase.FolderChildrenAction;
import com.openframe.test.data.dto.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.test.data.dto.knowledgebase.KnowledgeBaseItemType;
import com.openframe.test.data.dto.tag.TagDefinition;
import com.openframe.test.data.generator.KnowledgeBaseGenerator;
import com.openframe.test.data.generator.external.ExternalKnowledgeBaseGenerator;
import com.openframe.test.helpers.RelayIds;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.condition.EnabledIf;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * {@code /api/v1/knowledge-base} — the folder tree, the tag taxonomy (CP-41) and the article lifecycle
 * with its attachments (CP-42), one ordered case per state.
 *
 * <p>Built on records the class makes itself: a root folder holding a sub-folder and one article. Every
 * later case reads, moves, tags, publishes, archives or attaches to those, so nothing pre-existing on the
 * shared tenant is touched. State is carried between cases in static fields; a case whose record was never
 * made is skipped by an assumption rather than failing on that case's behalf. The last case deletes the
 * root folder with {@code childrenAction=ARCHIVE}, which hard-deletes the sub-folder and archives the
 * article — the strongest cleanup this API offers, since articles are never hard-deleted.
 *
 * <p>Every call costs one slot of the key's per-minute budget, so the cases assert on the responses they
 * already have rather than re-reading.
 *
 * <p>The External API cannot create a tag, and {@code GET /tags} only lists tags in use, so the tag is
 * created over GraphQL by "Tag an article" and deleted in {@link #cleanup()}.
 */
@Tag("external-api")
@Tag("knowledge-base")
@EnabledIf(ExternalApiBaseTest.EXTERNAL_API_KEY_CONDITION)
@DisplayName("ExtApi: External API - Knowledge Base")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ExternalKnowledgeBaseTest extends ExternalApiBaseTest {

    private static final String UNKNOWN_ID = "000000000000000000000000";
    private static final String KNOWLEDGE_ARTICLE = "KNOWLEDGE_ARTICLE";

    private static KnowledgeBaseItemResponse rootFolder;
    private static KnowledgeBaseItemResponse subFolder;
    private static KnowledgeBaseItemResponse article;
    private static TagDefinition tag;
    private static String tagId;
    private static Instant publishedAt;
    private static Path attachmentFile;
    private static KnowledgeBaseAttachmentResponse attachment;
    private static boolean attachmentDeleted;
    private static boolean articleArchived;
    private static boolean rootFolderDeleted;

    // --- folders (CP-41) ---------------------------------------------------------------------

    @Tag("feature")
    @Tag("create")
    @Order(1)
    @Test
    @DisplayName("ExtApi: Create a knowledge base folder at the root")
    public void testCreateRootFolder() {
        CreateFolderRequest request = ExternalKnowledgeBaseGenerator.createFolderRequest(null);

        rootFolder = ExternalKnowledgeBaseApi.createFolder(request);

        assertThat(rootFolder.getId()).as("Folder id should not be null").isNotNull();
        assertThat(rootFolder.getType()).as("A created folder is a FOLDER").isEqualTo(KnowledgeBaseItemType.FOLDER);
        assertThat(rootFolder.getName()).as("Folder name should be echoed back").isEqualTo(request.getName());
        assertThat(rootFolder.getParentId()).as("A folder created without a parent sits at the root").isNull();
        assertThat(rootFolder.getStatus()).as("Folders carry no article status").isNull();
    }

    @Tag("feature")
    @Tag("create")
    @Order(2)
    @Test
    @DisplayName("ExtApi: Create a knowledge base sub-folder")
    public void testCreateSubFolder() {
        fixture(rootFolder, "root folder");
        CreateFolderRequest request = ExternalKnowledgeBaseGenerator.createFolderRequest(rootFolder.getId());

        subFolder = ExternalKnowledgeBaseApi.createFolder(request);

        assertThat(subFolder.getName()).as("Folder name should be echoed back").isEqualTo(request.getName());
        assertThat(subFolder.getParentId()).as("A sub-folder should record its parent").isEqualTo(rootFolder.getId());
    }

    @Tag("feature")
    @Tag("update")
    @Order(3)
    @Test
    @DisplayName("ExtApi: Rename a knowledge base folder")
    public void testRenameFolder() {
        fixture(subFolder, "sub-folder");
        String newName = ExternalKnowledgeBaseGenerator.folderName();

        KnowledgeBaseItemResponse renamed = ExternalKnowledgeBaseApi.renameFolder(subFolder.getId(), newName);

        assertThat(renamed.getId()).as("Rename should not change the id").isEqualTo(subFolder.getId());
        assertThat(renamed.getName()).as("Folder should carry the new name").isEqualTo(newName);
        assertThat(renamed.getParentId()).as("Rename should not move the folder").isEqualTo(rootFolder.getId());
        subFolder = renamed;
    }

    @Tag("feature")
    @Tag("read")
    @Order(4)
    @Test
    @DisplayName("ExtApi: List knowledge base folders")
    public void testListFolders() {
        fixture(subFolder, "sub-folder");

        List<KnowledgeBaseItemResponse> folders = ExternalKnowledgeBaseApi.getFolders();

        assertThat(folders).as("The folder list holds folders only")
                .allSatisfy(folder -> assertThat(folder.getType()).isEqualTo(KnowledgeBaseItemType.FOLDER));
        assertThat(folders).as("The folder list should contain the root folder at the root")
                .anySatisfy(folder -> {
                    assertThat(folder.getId()).isEqualTo(rootFolder.getId());
                    assertThat(folder.getParentId()).isNull();
                });
        assertThat(folders).as("The folder list should contain the sub-folder, by its current name, under its parent")
                .anySatisfy(folder -> {
                    assertThat(folder.getId()).isEqualTo(subFolder.getId());
                    assertThat(folder.getName()).isEqualTo(subFolder.getName());
                    assertThat(folder.getParentId()).isEqualTo(rootFolder.getId());
                });
    }

    // --- article creation (CP-42) ------------------------------------------------------------

    @Tag("feature")
    @Tag("create")
    @Order(5)
    @Test
    @DisplayName("ExtApi: Create a draft article")
    public void testCreateArticle() {
        fixture(rootFolder, "root folder");
        CreateArticleRequest request = ExternalKnowledgeBaseGenerator.createArticleRequest(rootFolder.getId());

        article = ExternalKnowledgeBaseApi.createArticle(request);

        assertThat(article.getId()).as("Article id should not be null").isNotNull();
        assertThat(article.getType()).as("A created article is an ARTICLE").isEqualTo(KnowledgeBaseItemType.ARTICLE);
        assertThat(article.getName()).as("Name should be echoed back").isEqualTo(request.getName());
        assertThat(article.getParentId()).as("Article should land in the given folder").isEqualTo(rootFolder.getId());
        assertThat(article.getContent()).as("Content should be echoed back").isEqualTo(request.getContent());
        assertThat(article.getSummary()).as("Summary should be echoed back").isEqualTo(request.getSummary());
        assertThat(article.getStatus()).as("An article created without a status is a DRAFT")
                .isEqualTo(KnowledgeBaseArticleStatus.DRAFT);
        assertThat(article.getPublishedAt()).as("A draft has never been published").isNull();
        // The controller resolves the author from the API key's owner, never from the request.
        assertThat(article.getCreatedBy()).as("Author should be resolved from the API key").isNotNull();
        assertThat(article.getTags()).as("A new article has no tags").isEmpty();
        assertThat(article.getAttachments()).as("A new article has no attachments").isEmpty();
    }

    // --- items (CP-41) -----------------------------------------------------------------------

    @Tag("feature")
    @Tag("read")
    @Order(6)
    @Test
    @DisplayName("ExtApi: List a folder's children, folders first")
    public void testListFolderChildren() {
        fixture(subFolder, "sub-folder");
        fixture(article, "article");

        KnowledgeBaseItemsResponse children = ExternalKnowledgeBaseApi.listItems(Map.of("parentId", rootFolder.getId()));

        assertThat(children.getItems()).as("The root folder holds exactly the sub-folder, then the article")
                .extracting(KnowledgeBaseItemResponse::getId)
                .containsExactly(subFolder.getId(), article.getId());
        assertThat(children.getFilteredCount()).as("filteredCount should count both children").isEqualTo(2);
        assertThat(children.getPageInfo()).as("Paginated response should carry pageInfo").isNotNull();
        assertThat(children.getPageInfo().getHasNextPage()).as("Two items fit on one page").isFalse();
        assertThat(children.getItems().get(1).getContent()).as("List responses omit article content").isNull();
    }

    @Tag("feature")
    @Tag("read")
    @Order(7)
    @Test
    @DisplayName("ExtApi: Get a knowledge base item")
    public void testGetItem() {
        fixture(article, "article");

        KnowledgeBaseItemResponse fetched = ExternalKnowledgeBaseApi.getItem(article.getId());

        assertThat(fetched.getId()).as("Fetched item should be the one requested").isEqualTo(article.getId());
        assertThat(fetched.getContent()).as("The single read carries the content").isEqualTo(article.getContent());
    }

    @Tag("feature")
    @Tag("negative")
    @Order(8)
    @Test
    @DisplayName("ExtApi: Get an unknown knowledge base item is a 404")
    public void testGetUnknownItem() {
        ExternalErrorResponse error = ExternalKnowledgeBaseApi.attemptGetItem(UNKNOWN_ID, 404);

        assertThat(error.getCode()).as("Unknown item should report an error code").isNotNull();
    }

    @Tag("feature")
    @Tag("update")
    @Order(9)
    @Test
    @DisplayName("ExtApi: Move an item into another folder")
    public void testMoveItem() {
        fixture(subFolder, "sub-folder");
        fixture(article, "article");

        KnowledgeBaseItemResponse moved = ExternalKnowledgeBaseApi.moveItem(article.getId(), subFolder.getId());

        assertThat(moved.getId()).as("Move should not change the id").isEqualTo(article.getId());
        assertThat(moved.getParentId()).as("Article should now sit in the sub-folder").isEqualTo(subFolder.getId());
        article = moved;
    }

    @Tag("feature")
    @Tag("negative")
    @Order(10)
    @Test
    @DisplayName("ExtApi: A folder cannot be moved into its own descendant")
    public void testMoveFolderIntoDescendant() {
        fixture(subFolder, "sub-folder");

        ExternalErrorResponse error = ExternalKnowledgeBaseApi.attemptMoveItem(rootFolder.getId(), subFolder.getId(), 400);

        assertThat(error.getCode()).as("Moving a folder into its own descendant should be a 400").isNotNull();
    }

    // --- tags (CP-41) ------------------------------------------------------------------------

    @Tag("feature")
    @Tag("update")
    @Order(11)
    @Test
    @DisplayName("ExtApi: Tag an article")
    public void testTagArticle() {
        fixture(article, "article");
        // Unique per run, so deleting it in teardown cannot disturb a tag anyone else uses.
        tag = TagApi.createTag(ExternalKnowledgeBaseGenerator.tagKey(), KNOWLEDGE_ARTICLE, null, null);
        // GraphQL answers a Relay global id; the External API takes the raw id inside it.
        tagId = RelayIds.rawId(tag.getId());

        KnowledgeBaseItemResponse tagged = ExternalKnowledgeBaseApi.addTag(article.getId(), tagId);

        assertThat(tagged.getTags()).as("The added tag should be on the article")
                .anySatisfy(t -> {
                    assertThat(t.getId()).isEqualTo(tagId);
                    assertThat(t.getKey()).isEqualTo(tag.getKey());
                });
    }

    @Tag("feature")
    @Tag("read")
    @Order(12)
    @Test
    @DisplayName("ExtApi: List the tags in use, across the tenant and in a folder's subtree")
    public void testListTagsInUse() {
        requireTag();

        assertThat(ExternalKnowledgeBaseApi.getTags(Map.of()))
                .as("The tag list should include a tag now in use on an active article")
                .extracting(KnowledgeBaseTagResponse::getId).contains(tagId);
        // The article sits in the sub-folder, so this only passes if the scan covers the whole subtree.
        assertThat(ExternalKnowledgeBaseApi.getTags(Map.of("folderId", rootFolder.getId())))
                .as("The root folder's subtree tags should include the tag of the nested article")
                .extracting(KnowledgeBaseTagResponse::getId).containsExactly(tagId);
    }

    @Tag("feature")
    @Tag("update")
    @Order(13)
    @Test
    @DisplayName("ExtApi: Untag an article")
    public void testUntagArticle() {
        requireTag();

        KnowledgeBaseItemResponse untagged = ExternalKnowledgeBaseApi.removeTag(article.getId(), tagId);

        assertThat(untagged.getTags()).as("The removed tag should be gone from the article")
                .extracting(KnowledgeBaseTagResponse::getId).doesNotContain(tagId);
    }

    @Tag("feature")
    @Tag("negative")
    @Order(14)
    @Test
    @DisplayName("ExtApi: Tagging an article with an unknown tag is a 404")
    public void testTagArticleWithUnknownTag() {
        fixture(article, "article");

        ExternalErrorResponse error = ExternalKnowledgeBaseApi.attemptAddTag(article.getId(), UNKNOWN_ID, 404);

        assertThat(error.getCode()).as("Attaching an unknown tag should be a 404").isNotNull();
    }

    // --- article lifecycle (CP-42) -----------------------------------------------------------

    @Tag("feature")
    @Tag("update")
    @Order(15)
    @Test
    @DisplayName("ExtApi: Update an article")
    public void testUpdateArticle() {
        fixture(article, "article");
        UpdateArticleRequest request = ExternalKnowledgeBaseGenerator.updateArticleRequest();

        KnowledgeBaseItemResponse updated = ExternalKnowledgeBaseApi.updateArticle(article.getId(), request);

        assertThat(updated.getId()).as("Update should not change the id").isEqualTo(article.getId());
        assertThat(updated.getName()).as("Name should be updated").isEqualTo(request.getName());
        assertThat(updated.getContent()).as("Content should be updated").isEqualTo(request.getContent());
        assertThat(updated.getSummary()).as("Summary should be updated").isEqualTo(request.getSummary());
        assertThat(updated.getParentId()).as("An update without parentId should not move the article")
                .isEqualTo(article.getParentId());
        assertThat(updated.getStatus()).as("An update should not change the status")
                .isEqualTo(KnowledgeBaseArticleStatus.DRAFT);
        assertThat(updated.getLastModifiedBy()).as("The editor should be resolved from the API key").isNotNull();
        article = updated;
    }

    @Tag("feature")
    @Tag("update")
    @Order(16)
    @Test
    @DisplayName("ExtApi: Publish an article")
    public void testPublishArticle() {
        fixture(article, "article");

        KnowledgeBaseItemResponse published = ExternalKnowledgeBaseApi.publishArticle(article.getId());

        assertThat(published.getStatus()).as("Status should be PUBLISHED after publish")
                .isEqualTo(KnowledgeBaseArticleStatus.PUBLISHED);
        assertThat(published.getPublishedAt()).as("publishedAt is stamped on the first publish").isNotNull();
        publishedAt = published.getPublishedAt();
        article = published;
    }

    @Tag("feature")
    @Tag("update")
    @Order(17)
    @Test
    @DisplayName("ExtApi: Unpublish an article")
    public void testUnpublishArticle() {
        fixture(article, "article");
        assumeTrue(publishedAt != null, "Skipped: the step publishing the article did not complete");

        KnowledgeBaseItemResponse unpublished = ExternalKnowledgeBaseApi.unpublishArticle(article.getId());

        assertThat(unpublished.getStatus()).as("Status should return to DRAFT after unpublish")
                .isEqualTo(KnowledgeBaseArticleStatus.DRAFT);
        // publishedAt is "first published at": unpublishing must not clear or move it.
        assertThat(unpublished.getPublishedAt()).as("Unpublish should keep the first-publication timestamp")
                .isEqualTo(publishedAt.truncatedTo(ChronoUnit.MILLIS));
        article = unpublished;
    }

    @Tag("feature")
    @Tag("update")
    @Order(18)
    @Test
    @DisplayName("ExtApi: Archive an article")
    public void testArchiveArticle() {
        fixture(article, "article");

        KnowledgeBaseItemResponse archived = ExternalKnowledgeBaseApi.archiveArticle(article.getId());
        articleArchived = true;

        assertThat(archived.getStatus()).as("Status should be ARCHIVED after archive")
                .isEqualTo(KnowledgeBaseArticleStatus.ARCHIVED);
    }

    @Tag("feature")
    @Tag("read")
    @Order(19)
    @Test
    @DisplayName("ExtApi: List archived articles")
    public void testListArchivedArticles() {
        fixture(article, "article");
        assumeTrue(articleArchived, "Skipped: the step archiving the article did not complete");

        KnowledgeBaseItemsResponse archivedList = ExternalKnowledgeBaseApi.getArchivedArticles(Map.of("search", article.getName()));

        assertThat(archivedList.getItems()).as("The archived list should find the archived article by name")
                .extracting(KnowledgeBaseItemResponse::getId).containsExactly(article.getId());
        assertThat(archivedList.getItems()).as("Every archived-list entry is ARCHIVED")
                .allSatisfy(item -> assertThat(item.getStatus()).isEqualTo(KnowledgeBaseArticleStatus.ARCHIVED));
    }

    @Tag("feature")
    @Tag("update")
    @Order(20)
    @Test
    @DisplayName("ExtApi: Restore an archived article into a folder")
    public void testUnarchiveArticle() {
        fixture(article, "article");
        assumeTrue(articleArchived, "Skipped: the step archiving the article did not complete");

        KnowledgeBaseItemResponse restored = ExternalKnowledgeBaseApi.unarchiveArticle(article.getId(), rootFolder.getId());
        articleArchived = false;

        assertThat(restored.getStatus()).as("Unarchive restores the article as PUBLISHED")
                .isEqualTo(KnowledgeBaseArticleStatus.PUBLISHED);
        assertThat(restored.getParentId()).as("Unarchive places the article in the given folder")
                .isEqualTo(rootFolder.getId());
        article = restored;
    }

    @Tag("feature")
    @Tag("negative")
    @Order(21)
    @Test
    @DisplayName("ExtApi: Restoring an article that is not archived is a 409")
    public void testUnarchiveActiveArticle() {
        fixture(article, "article");
        assumeTrue(!articleArchived, "Skipped: the article is still archived; see \"Restore an archived article into a folder\"");

        ExternalErrorResponse error = ExternalKnowledgeBaseApi.attemptUnarchiveArticle(article.getId(), rootFolder.getId(), 409);

        assertThat(error.getCode()).as("Unarchiving an article that is not archived should be a 409").isNotNull();
    }

    // --- attachments (CP-42) -----------------------------------------------------------------

    @Tag("feature")
    @Tag("create")
    @Order(22)
    @Test
    @DisplayName("ExtApi: Attach a file to an article")
    public void testAttachFile() {
        fixture(article, "article");
        attachmentFile = KnowledgeBaseGenerator.attachmentFile();
        CreateKnowledgeBaseAttachmentRequest request = ExternalKnowledgeBaseGenerator.attachmentRequest(attachmentFile);

        KnowledgeBaseAttachmentUploadResponse upload = ExternalKnowledgeBaseApi.createAttachment(article.getId(), request);
        attachment = upload.getAttachment();
        AttachmentApi.uploadAttachmentFile(upload.getUploadUrl(), attachmentFile, request.getContentType());

        assertThat(attachment.getId()).as("Attachment id should not be null").isNotNull();
        assertThat(attachment.getItemId()).as("Attachment should belong to the article").isEqualTo(article.getId());
        assertThat(attachment.getFileName()).as("File name should be echoed back").isEqualTo(request.getFileName());
        assertThat(attachment.getContentType()).as("Content type should be echoed back").isEqualTo(request.getContentType());
        assertThat(attachment.getFileSize()).as("File size should be echoed back").isEqualTo(request.getFileSize());
        assertThat(attachment.getUploadedBy()).as("Uploader should be resolved from the API key").isNotNull();
        assertThat(upload.getUploadUrl()).as("Upload URL should be an http(s) URL").startsWith("http");
    }

    @Tag("feature")
    @Tag("read")
    @Order(23)
    @Test
    @DisplayName("ExtApi: Download an attachment byte for byte")
    public void testDownloadAttachment() throws IOException {
        requireAttachment();

        String downloadUrl = ExternalKnowledgeBaseApi.getAttachmentDownloadUrl(attachment.getId());

        assertThat(downloadUrl).as("Download URL should be an http(s) URL").startsWith("http");
        assertThat(AttachmentApi.downloadAttachmentFile(downloadUrl))
                .as("The downloaded bytes are the uploaded bytes").isEqualTo(Files.readAllBytes(attachmentFile));
    }

    @Tag("feature")
    @Tag("delete")
    @Order(24)
    @Test
    @DisplayName("ExtApi: Delete an attachment")
    public void testDeleteAttachment() {
        requireAttachment();

        ExternalKnowledgeBaseApi.deleteAttachment(attachment.getId());
        attachmentDeleted = true;

        ExternalErrorResponse error = ExternalKnowledgeBaseApi.attemptGetAttachmentDownloadUrl(attachment.getId(), 404);
        assertThat(error.getCode()).as("A deleted attachment should be a 404").isNotNull();
    }

    // --- folder deletion (CP-41) -------------------------------------------------------------

    @Tag("feature")
    @Tag("negative")
    @Order(25)
    @Test
    @DisplayName("ExtApi: A non-empty folder cannot be deleted without a childrenAction")
    public void testDeleteNonEmptyFolderWithoutChildrenAction() {
        fixture(rootFolder, "root folder");

        ExternalErrorResponse error = ExternalKnowledgeBaseApi.attemptDeleteFolder(rootFolder.getId(), 400);

        assertThat(error.getCode()).as("A non-empty folder without childrenAction should be a 400").isNotNull();
    }

    @Tag("feature")
    @Tag("delete")
    @Order(26)
    @Test
    @DisplayName("ExtApi: Delete a non-empty folder, archiving its articles")
    public void testDeleteFolderArchivingChildren() {
        fixture(rootFolder, "root folder");
        fixture(article, "article");

        ExternalKnowledgeBaseApi.deleteFolder(rootFolder.getId(), FolderChildrenAction.ARCHIVE);
        rootFolderDeleted = true;
        articleArchived = true;

        ExternalKnowledgeBaseApi.attemptGetItem(rootFolder.getId(), 404);
        KnowledgeBaseItemResponse orphan = ExternalKnowledgeBaseApi.getItem(article.getId());
        assertThat(orphan.getStatus()).as("Deleting with ARCHIVE archives the articles in the folder")
                .isEqualTo(KnowledgeBaseArticleStatus.ARCHIVED);
        assertThat(orphan.getParentId()).as("An article archived with its folder is detached to the root").isNull();
    }

    /**
     * Undoes what a failed run left behind; on a green run only the tag remains to delete. Every call here
     * returns the HTTP status instead of throwing, so one failed step cannot strand the rest. Deleting the
     * root folder archives the article with it, so the article archive that follows may answer 409.
     */
    @AfterAll
    public static void cleanup() {
        if (attachment != null && !attachmentDeleted) {
            ExternalKnowledgeBaseApi.deleteAttachmentRaw(attachment.getId());
        }
        if (rootFolder != null && !rootFolderDeleted) {
            ExternalKnowledgeBaseApi.deleteFolderRaw(rootFolder.getId(), FolderChildrenAction.ARCHIVE);
        }
        if (article != null && !articleArchived) {
            ExternalKnowledgeBaseApi.archiveArticleRaw(article.getId());
        }
        if (tag != null) {
            TagApi.attemptDeleteTag(tag.getId());
        }
    }

    /** Aborts a dependent case as skipped, with a reason, when the fixture it builds on was never made. */
    private static void fixture(KnowledgeBaseItemResponse item, String what) {
        assumeTrue(item != null, "Skipped: the step creating the " + what + " did not complete");
    }

    private static void requireTag() {
        fixture(article, "article");
        assumeTrue(tagId != null, "Skipped: the step tagging the article did not complete");
    }

    private static void requireAttachment() {
        assumeTrue(attachment != null, "Skipped: the step attaching a file did not complete");
    }
}
