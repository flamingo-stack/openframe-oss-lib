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
import lombok.extern.slf4j.Slf4j;
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
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * {@code /api/v1/knowledge-base} — the folder tree, the tag taxonomy (CP-41) and the article lifecycle
 * with its attachments (CP-42).
 *
 * <p>Ordered, and built on records the class makes itself: a root folder holding a sub-folder and one
 * article. Every later case reads, moves, tags, publishes, archives or attaches to those, so nothing
 * pre-existing on the shared tenant is touched. The last case deletes the root folder with
 * {@code childrenAction=ARCHIVE}, which hard-deletes the sub-folder and archives the article — the
 * strongest cleanup this API offers, since articles are never hard-deleted.
 *
 * <p>Every call costs one slot of the key's 5-requests-per-minute budget (about 13 s of pacing), so
 * the cases chain their assertions on the responses they already have rather than re-reading.
 *
 * <p>The External API cannot create a tag, and {@code GET /tags} only lists tags in use, so the tag
 * the tag case attaches is created over GraphQL by that case and deleted in {@link #cleanup()}.
 */
@Tag("external-api")
@Tag("knowledge-base")
@EnabledIf(ExternalApiBaseTest.EXTERNAL_API_KEY_CONDITION)
@DisplayName("ExtApi: External API - Knowledge Base")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Slf4j
public class ExternalKnowledgeBaseTest extends ExternalApiBaseTest {

    private static final String UNKNOWN_ID = "000000000000000000000000";
    private static final String KNOWLEDGE_ARTICLE = "KNOWLEDGE_ARTICLE";

    private static TagDefinition tag;
    private static KnowledgeBaseItemResponse rootFolder;
    private static KnowledgeBaseItemResponse subFolder;
    private static KnowledgeBaseItemResponse article;
    /** Set while an attachment exists that the attachment case has not deleted yet. */
    private static String pendingAttachmentId;
    private static boolean articleArchived;
    private static boolean rootFolderDeleted;

    /**
     * Undoes whatever a failed run left behind; on a green run only the tag remains to delete. Each
     * step is best-effort so one failure does not strand the rest or mask the real test result.
     */
    @AfterAll
    public static void cleanup() {
        if (pendingAttachmentId != null) {
            bestEffort("delete attachment " + pendingAttachmentId,
                    () -> ExternalKnowledgeBaseApi.deleteAttachmentRaw(pendingAttachmentId));
        }
        if (rootFolder != null && !rootFolderDeleted) {
            // Archives every article in the subtree — the class's article never leaves it — and
            // hard-deletes the sub-folder with it.
            bestEffort("delete folder " + rootFolder.getId(), () -> {
                if (ExternalKnowledgeBaseApi.deleteFolderRaw(rootFolder.getId(), FolderChildrenAction.ARCHIVE)
                        .statusCode() == 204) {
                    articleArchived = true;
                }
            });
        }
        if (article != null && !articleArchived) {
            bestEffort("archive article " + article.getId(),
                    () -> ExternalKnowledgeBaseApi.archiveArticleRaw(article.getId()));
        }
        if (tag != null) {
            bestEffort("delete tag " + tag.getId(), () -> TagApi.deleteTag(tag.getId()));
        }
    }

    private static void bestEffort(String what, Runnable step) {
        try {
            step.run();
            log.info("Cleanup: {}", what);
        } catch (Exception e) {
            log.warn("Could not {} during teardown: {}", what, e.getMessage());
        }
    }

    /** Aborts a dependent case as skipped, with a reason, when the fixture it builds on was never made. */
    private static KnowledgeBaseItemResponse fixture(KnowledgeBaseItemResponse item, String what) {
        assumeTrue(item != null, "Skipped: the step creating the " + what + " did not complete");
        return item;
    }

    // --- folders (CP-41) ---------------------------------------------------------------------

    @Tag("feature")
    @Tag("create")
    @Order(1)
    @Test
    @DisplayName("ExtApi: Create, rename and list knowledge base folders")
    public void testCreateRenameAndListFolders() {
        CreateFolderRequest rootRequest = ExternalKnowledgeBaseGenerator.createFolderRequest(null);
        rootFolder = ExternalKnowledgeBaseApi.createFolder(rootRequest);
        assertThat(rootFolder.getId()).as("Folder id should not be null").isNotNull();
        assertThat(rootFolder.getType()).as("A created folder is a FOLDER").isEqualTo(KnowledgeBaseItemType.FOLDER);
        assertThat(rootFolder.getName()).as("Folder name should be echoed back").isEqualTo(rootRequest.getName());
        assertThat(rootFolder.getParentId()).as("A folder created without a parent sits at the root").isNull();
        assertThat(rootFolder.getStatus()).as("Folders carry no article status").isNull();

        CreateFolderRequest subRequest = ExternalKnowledgeBaseGenerator.createFolderRequest(rootFolder.getId());
        subFolder = ExternalKnowledgeBaseApi.createFolder(subRequest);
        assertThat(subFolder.getParentId()).as("A sub-folder should record its parent").isEqualTo(rootFolder.getId());

        String newName = ExternalKnowledgeBaseGenerator.folderName();
        KnowledgeBaseItemResponse renamed = ExternalKnowledgeBaseApi.renameFolder(subFolder.getId(), newName);
        assertThat(renamed.getId()).as("Rename should not change the id").isEqualTo(subFolder.getId());
        assertThat(renamed.getName()).as("Folder should carry the new name").isEqualTo(newName);
        assertThat(renamed.getParentId()).as("Rename should not move the folder").isEqualTo(rootFolder.getId());
        subFolder = renamed;

        List<KnowledgeBaseItemResponse> folders = ExternalKnowledgeBaseApi.getFolders();
        assertThat(folders).as("The folder list holds folders only")
                .allSatisfy(folder -> assertThat(folder.getType()).isEqualTo(KnowledgeBaseItemType.FOLDER));
        assertThat(folders).as("The folder list should contain the root folder at the root")
                .anySatisfy(folder -> {
                    assertThat(folder.getId()).isEqualTo(rootFolder.getId());
                    assertThat(folder.getParentId()).isNull();
                });
        assertThat(folders).as("The folder list should contain the renamed sub-folder under its parent")
                .anySatisfy(folder -> {
                    assertThat(folder.getId()).isEqualTo(subFolder.getId());
                    assertThat(folder.getName()).isEqualTo(newName);
                    assertThat(folder.getParentId()).isEqualTo(rootFolder.getId());
                });
    }

    // --- article creation (CP-42) ------------------------------------------------------------

    @Tag("feature")
    @Tag("create")
    @Order(2)
    @Test
    @DisplayName("ExtApi: Create a draft article")
    public void testCreateArticle() {
        CreateArticleRequest request = ExternalKnowledgeBaseGenerator
                .createArticleRequest(fixture(rootFolder, "root folder").getId());
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
    @Order(3)
    @Test
    @DisplayName("ExtApi: List a folder's children folders first, and read an item")
    public void testListAndGetItems() {
        fixture(subFolder, "sub-folder");
        fixture(article, "article");

        KnowledgeBaseItemsResponse children = ExternalKnowledgeBaseApi
                .listItems(Map.of("parentId", rootFolder.getId()));
        assertThat(children.getItems()).as("The root folder holds exactly the sub-folder, then the article")
                .extracting(KnowledgeBaseItemResponse::getId)
                .containsExactly(subFolder.getId(), article.getId());
        assertThat(children.getFilteredCount()).as("filteredCount should count both children").isEqualTo(2);
        assertThat(children.getPageInfo()).as("Paginated response should carry pageInfo").isNotNull();
        assertThat(children.getPageInfo().getHasNextPage()).as("Two items fit on one page").isFalse();
        assertThat(children.getItems().get(1).getContent()).as("List responses omit article content").isNull();

        KnowledgeBaseItemResponse fetched = ExternalKnowledgeBaseApi.getItem(article.getId());
        assertThat(fetched.getId()).as("Fetched item should be the one requested").isEqualTo(article.getId());
        assertThat(fetched.getContent()).as("The single read carries the content").isEqualTo(article.getContent());

        ExternalErrorResponse error = ExternalKnowledgeBaseApi.attemptGetItem(UNKNOWN_ID, 404);
        assertThat(error.getCode()).as("Unknown item should report an error code").isNotNull();
    }

    @Tag("feature")
    @Tag("update")
    @Order(4)
    @Test
    @DisplayName("ExtApi: Move an item into another folder, never into its own descendant")
    public void testMoveItem() {
        fixture(subFolder, "sub-folder");
        fixture(article, "article");

        KnowledgeBaseItemResponse moved = ExternalKnowledgeBaseApi.moveItem(article.getId(), subFolder.getId());
        assertThat(moved.getId()).as("Move should not change the id").isEqualTo(article.getId());
        assertThat(moved.getParentId()).as("Article should now sit in the sub-folder").isEqualTo(subFolder.getId());
        article = moved;

        ExternalErrorResponse error = ExternalKnowledgeBaseApi
                .attemptMoveItem(rootFolder.getId(), subFolder.getId(), 400);
        assertThat(error.getCode()).as("Moving a folder into its own descendant should be a 400").isNotNull();
    }

    // --- tags (CP-41) ------------------------------------------------------------------------

    @Tag("feature")
    @Tag("update")
    @Order(5)
    @Test
    @DisplayName("ExtApi: Tag an article, list the tags in use, and untag it")
    public void testTagAndUntagArticle() {
        fixture(article, "article");
        // Unique per run, so deleting it in teardown cannot disturb a tag anyone else uses.
        tag = TagApi.createTag(ExternalKnowledgeBaseGenerator.tagKey(), KNOWLEDGE_ARTICLE, null, null);
        // GraphQL answers a Relay global id; the External API takes the raw id inside it.
        String tagId = RelayIds.rawId(tag.getId());

        KnowledgeBaseItemResponse tagged = ExternalKnowledgeBaseApi.addTag(article.getId(), tagId);
        assertThat(tagged.getTags()).as("The added tag should be on the article")
                .anySatisfy(t -> {
                    assertThat(t.getId()).isEqualTo(tagId);
                    assertThat(t.getKey()).isEqualTo(tag.getKey());
                });

        assertThat(ExternalKnowledgeBaseApi.getTags(Map.of()))
                .as("The tag list should include a tag now in use on an active article")
                .extracting(KnowledgeBaseTagResponse::getId).contains(tagId);
        // The article sits in the sub-folder, so this only passes if the scan covers the whole subtree.
        assertThat(ExternalKnowledgeBaseApi.getTags(Map.of("folderId", rootFolder.getId())))
                .as("The root folder's subtree tags should include the tag of the nested article")
                .extracting(KnowledgeBaseTagResponse::getId).containsExactly(tagId);

        KnowledgeBaseItemResponse untagged = ExternalKnowledgeBaseApi.removeTag(article.getId(), tagId);
        assertThat(untagged.getTags()).as("The removed tag should be gone from the article")
                .extracting(KnowledgeBaseTagResponse::getId).doesNotContain(tagId);

        ExternalErrorResponse error = ExternalKnowledgeBaseApi.attemptAddTag(article.getId(), UNKNOWN_ID, 404);
        assertThat(error.getCode()).as("Attaching an unknown tag should be a 404").isNotNull();
    }

    // --- article lifecycle (CP-42) -----------------------------------------------------------

    @Tag("feature")
    @Tag("update")
    @Order(6)
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
    @Order(7)
    @Test
    @DisplayName("ExtApi: Publish and unpublish an article")
    public void testPublishAndUnpublishArticle() {
        fixture(article, "article");

        KnowledgeBaseItemResponse published = ExternalKnowledgeBaseApi.publishArticle(article.getId());
        assertThat(published.getStatus()).as("Status should be PUBLISHED after publish")
                .isEqualTo(KnowledgeBaseArticleStatus.PUBLISHED);
        assertThat(published.getPublishedAt()).as("publishedAt is stamped on the first publish").isNotNull();

        KnowledgeBaseItemResponse unpublished = ExternalKnowledgeBaseApi.unpublishArticle(article.getId());
        assertThat(unpublished.getStatus()).as("Status should return to DRAFT after unpublish")
                .isEqualTo(KnowledgeBaseArticleStatus.DRAFT);
        // publishedAt is "first published at": unpublishing must not clear or move it.
        assertThat(unpublished.getPublishedAt()).as("Unpublish should keep the first-publication timestamp")
                .isEqualTo(published.getPublishedAt().truncatedTo(ChronoUnit.MILLIS));
        article = unpublished;
    }

    @Tag("feature")
    @Tag("update")
    @Order(8)
    @Test
    @DisplayName("ExtApi: Archive an article and restore it into a folder")
    public void testArchiveAndUnarchiveArticle() {
        fixture(article, "article");

        KnowledgeBaseItemResponse archived = ExternalKnowledgeBaseApi.archiveArticle(article.getId());
        articleArchived = true;
        assertThat(archived.getStatus()).as("Status should be ARCHIVED after archive")
                .isEqualTo(KnowledgeBaseArticleStatus.ARCHIVED);

        KnowledgeBaseItemsResponse archivedList = ExternalKnowledgeBaseApi
                .getArchivedArticles(Map.of("search", article.getName()));
        assertThat(archivedList.getItems()).as("The archived list should find the archived article by name")
                .extracting(KnowledgeBaseItemResponse::getId).containsExactly(article.getId());
        assertThat(archivedList.getItems()).as("Every archived-list entry is ARCHIVED")
                .allSatisfy(item -> assertThat(item.getStatus()).isEqualTo(KnowledgeBaseArticleStatus.ARCHIVED));

        KnowledgeBaseItemResponse restored = ExternalKnowledgeBaseApi
                .unarchiveArticle(article.getId(), rootFolder.getId());
        articleArchived = false;
        assertThat(restored.getStatus()).as("Unarchive restores the article as PUBLISHED")
                .isEqualTo(KnowledgeBaseArticleStatus.PUBLISHED);
        assertThat(restored.getParentId()).as("Unarchive places the article in the given folder")
                .isEqualTo(rootFolder.getId());
        article = restored;

        ExternalErrorResponse error = ExternalKnowledgeBaseApi
                .attemptUnarchiveArticle(article.getId(), rootFolder.getId(), 409);
        assertThat(error.getCode()).as("Unarchiving an article that is not archived should be a 409").isNotNull();
    }

    // --- attachments (CP-42) -----------------------------------------------------------------

    @Tag("feature")
    @Tag("create")
    @Order(9)
    @Test
    @DisplayName("ExtApi: Attach a file, download it byte for byte, and delete it")
    public void testAttachmentRoundTrip() throws IOException {
        fixture(article, "article");

        Path file = KnowledgeBaseGenerator.attachmentFile();
        CreateKnowledgeBaseAttachmentRequest request = ExternalKnowledgeBaseGenerator.attachmentRequest(file);
        KnowledgeBaseAttachmentUploadResponse upload = ExternalKnowledgeBaseApi
                .createAttachment(article.getId(), request);
        KnowledgeBaseAttachmentResponse attachment = upload.getAttachment();
        pendingAttachmentId = attachment.getId();

        assertThat(attachment.getId()).as("Attachment id should not be null").isNotNull();
        assertThat(attachment.getItemId()).as("Attachment should belong to the article").isEqualTo(article.getId());
        assertThat(attachment.getFileName()).as("File name should be echoed back").isEqualTo(request.getFileName());
        assertThat(attachment.getContentType()).as("Content type should be echoed back")
                .isEqualTo(request.getContentType());
        assertThat(attachment.getFileSize()).as("File size should be echoed back").isEqualTo(request.getFileSize());
        assertThat(attachment.getUploadedBy()).as("Uploader should be resolved from the API key").isNotNull();
        assertThat(upload.getUploadUrl()).as("Upload URL should be an http(s) URL").startsWith("http");

        AttachmentApi.uploadAttachmentFile(upload.getUploadUrl(), file, request.getContentType());

        String downloadUrl = ExternalKnowledgeBaseApi.getAttachmentDownloadUrl(attachment.getId());
        assertThat(downloadUrl).as("Download URL should be an http(s) URL").startsWith("http");
        assertThat(AttachmentApi.downloadAttachmentFile(downloadUrl))
                .as("The downloaded bytes are the uploaded bytes").isEqualTo(Files.readAllBytes(file));

        ExternalKnowledgeBaseApi.deleteAttachment(attachment.getId());
        pendingAttachmentId = null;

        ExternalErrorResponse error = ExternalKnowledgeBaseApi
                .attemptGetAttachmentDownloadUrl(attachment.getId(), 404);
        assertThat(error.getCode()).as("A deleted attachment should be a 404").isNotNull();
    }

    // --- folder deletion (CP-41) -------------------------------------------------------------

    @Tag("feature")
    @Tag("delete")
    @Order(10)
    @Test
    @DisplayName("ExtApi: Delete a non-empty folder, archiving its articles")
    public void testDeleteFolderArchivingChildren() {
        fixture(rootFolder, "root folder");
        fixture(article, "article");

        ExternalErrorResponse error = ExternalKnowledgeBaseApi.attemptDeleteFolder(rootFolder.getId(), 400);
        assertThat(error.getCode()).as("A non-empty folder without childrenAction should be a 400").isNotNull();

        ExternalKnowledgeBaseApi.deleteFolder(rootFolder.getId(), FolderChildrenAction.ARCHIVE);
        rootFolderDeleted = true;
        articleArchived = true;

        ExternalKnowledgeBaseApi.attemptGetItem(rootFolder.getId(), 404);
        KnowledgeBaseItemResponse orphan = ExternalKnowledgeBaseApi.getItem(article.getId());
        assertThat(orphan.getStatus()).as("Deleting with ARCHIVE archives the articles in the folder")
                .isEqualTo(KnowledgeBaseArticleStatus.ARCHIVED);
        assertThat(orphan.getParentId()).as("An article archived with its folder is detached to the root")
                .isNull();
    }
}
