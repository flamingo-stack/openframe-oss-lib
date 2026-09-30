package com.openframe.test.api.external;

import com.openframe.test.data.dto.external.common.ExternalErrorResponse;
import com.openframe.test.data.dto.external.knowledgebase.CreateArticleRequest;
import com.openframe.test.data.dto.external.knowledgebase.CreateFolderRequest;
import com.openframe.test.data.dto.external.knowledgebase.CreateKnowledgeBaseAttachmentRequest;
import com.openframe.test.data.dto.external.knowledgebase.KnowledgeBaseAttachmentDownloadResponse;
import com.openframe.test.data.dto.external.knowledgebase.KnowledgeBaseAttachmentUploadResponse;
import com.openframe.test.data.dto.external.knowledgebase.KnowledgeBaseItemResponse;
import com.openframe.test.data.dto.external.knowledgebase.KnowledgeBaseItemsResponse;
import com.openframe.test.data.dto.external.knowledgebase.KnowledgeBaseTagResponse;
import com.openframe.test.data.dto.external.knowledgebase.MoveKnowledgeBaseItemRequest;
import com.openframe.test.data.dto.external.knowledgebase.RenameFolderRequest;
import com.openframe.test.data.dto.external.knowledgebase.UnarchiveArticleRequest;
import com.openframe.test.data.dto.external.knowledgebase.UpdateArticleRequest;
import com.openframe.test.data.dto.knowledgebase.FolderChildrenAction;
import io.restassured.response.Response;

import java.util.List;
import java.util.Map;

import static com.openframe.test.helpers.RequestSpecHelper.getExternalApiSpec;
import static io.restassured.RestAssured.given;

/**
 * External API client for {@code /api/v1/knowledge-base} — folders, articles, tags and attachments.
 *
 * <p>The controller runs the same domain services as the dashboard's GraphQL API, on behalf of the API
 * key's owner, so the folder and article rules are the ones {@code KnowledgeBaseTest} asserts over
 * GraphQL. What differs is the error contract: an unknown id, or an id of the other item kind on a
 * folder- or article-only route, is a 404; a bad argument (missing parent, a folder moved into its own
 * descendant, a non-empty folder deleted without {@code childrenAction}) is a 400; a state conflict
 * (unarchiving an article that is not archived) is a 409.
 *
 * <p>Folders are hard-deleted; articles never are — archive is their terminal state.
 */
public class ExternalKnowledgeBaseApi {

    private static final String KB = "api/v1/knowledge-base";
    private static final String ITEMS = KB + "/items";
    private static final String ITEM_BY_ID = ITEMS + "/{id}";
    private static final String MOVE = ITEM_BY_ID + "/move";
    private static final String ITEM_TAG = ITEM_BY_ID + "/tags/{tagId}";
    private static final String FOLDERS = KB + "/folders";
    private static final String FOLDER_BY_ID = FOLDERS + "/{id}";
    private static final String ARTICLES = KB + "/articles";
    private static final String ARCHIVED_ARTICLES = ARTICLES + "/archived";
    private static final String ARTICLE_BY_ID = ARTICLES + "/{id}";
    private static final String PUBLISH = ARTICLE_BY_ID + "/publish";
    private static final String UNPUBLISH = ARTICLE_BY_ID + "/unpublish";
    private static final String ARCHIVE = ARTICLE_BY_ID + "/archive";
    private static final String UNARCHIVE = ARTICLE_BY_ID + "/unarchive";
    private static final String ARTICLE_ATTACHMENTS = ARTICLE_BY_ID + "/attachments";
    private static final String TAGS = KB + "/tags";
    private static final String ATTACHMENT_BY_ID = KB + "/attachments/{attachmentId}";
    private static final String DOWNLOAD_URL = ATTACHMENT_BY_ID + "/download-url";

    private static final String CHILDREN_ACTION = "childrenAction";

    // --- items -------------------------------------------------------------------------------

    /** Folders first, then articles; archived articles are never listed here. */
    public static KnowledgeBaseItemsResponse listItems(Map<String, Object> queryParams) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(ITEMS)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseItemsResponse.class);
    }

    /** The single read is the one that carries an article's {@code content}. */
    public static KnowledgeBaseItemResponse getItem(String id) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .get(ITEM_BY_ID)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseItemResponse.class);
    }

    public static ExternalErrorResponse attemptGetItem(String id, int expectedStatus) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .get(ITEM_BY_ID)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    /** {@code parentId} null moves the item to the root. */
    public static KnowledgeBaseItemResponse moveItem(String id, String parentId) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(MoveKnowledgeBaseItemRequest.builder().parentId(parentId).build())
                .post(MOVE)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseItemResponse.class);
    }

    public static ExternalErrorResponse attemptMoveItem(String id, String parentId, int expectedStatus) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(MoveKnowledgeBaseItemRequest.builder().parentId(parentId).build())
                .post(MOVE)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    public static KnowledgeBaseItemResponse addTag(String id, String tagId) {
        return given(getExternalApiSpec())
                .pathParams("id", id, "tagId", tagId)
                .post(ITEM_TAG)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseItemResponse.class);
    }

    public static ExternalErrorResponse attemptAddTag(String id, String tagId, int expectedStatus) {
        return given(getExternalApiSpec())
                .pathParams("id", id, "tagId", tagId)
                .post(ITEM_TAG)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    public static KnowledgeBaseItemResponse removeTag(String id, String tagId) {
        return given(getExternalApiSpec())
                .pathParams("id", id, "tagId", tagId)
                .delete(ITEM_TAG)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseItemResponse.class);
    }

    // --- folders -----------------------------------------------------------------------------

    /** Every folder, flat and ordered by name; the tree is rebuilt from {@code parentId}. */
    public static List<KnowledgeBaseItemResponse> getFolders() {
        return given(getExternalApiSpec())
                .get(FOLDERS)
                .then().statusCode(200)
                .extract().jsonPath().getList(".", KnowledgeBaseItemResponse.class);
    }

    public static KnowledgeBaseItemResponse createFolder(CreateFolderRequest request) {
        return given(getExternalApiSpec())
                .body(request)
                .post(FOLDERS)
                .then().statusCode(201)
                .extract().as(KnowledgeBaseItemResponse.class);
    }

    public static KnowledgeBaseItemResponse renameFolder(String id, String name) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(RenameFolderRequest.builder().name(name).build())
                .patch(FOLDER_BY_ID)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseItemResponse.class);
    }

    /** 204 No Content. A non-empty folder needs a {@code childrenAction}. */
    public static void deleteFolder(String id, FolderChildrenAction childrenAction) {
        deleteFolderRaw(id, childrenAction).then().statusCode(204);
    }

    public static ExternalErrorResponse attemptDeleteFolder(String id, int expectedStatus) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .delete(FOLDER_BY_ID)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    /** Unchecked, for teardown. */
    public static Response deleteFolderRaw(String id, FolderChildrenAction childrenAction) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .queryParam(CHILDREN_ACTION, childrenAction)
                .delete(FOLDER_BY_ID);
    }

    // --- articles ----------------------------------------------------------------------------

    public static KnowledgeBaseItemsResponse getArchivedArticles(Map<String, Object> queryParams) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(ARCHIVED_ARTICLES)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseItemsResponse.class);
    }

    public static KnowledgeBaseItemResponse createArticle(CreateArticleRequest request) {
        return given(getExternalApiSpec())
                .body(request)
                .post(ARTICLES)
                .then().statusCode(201)
                .extract().as(KnowledgeBaseItemResponse.class);
    }

    public static KnowledgeBaseItemResponse updateArticle(String id, UpdateArticleRequest request) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(request)
                .patch(ARTICLE_BY_ID)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseItemResponse.class);
    }

    public static KnowledgeBaseItemResponse publishArticle(String id) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .post(PUBLISH)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseItemResponse.class);
    }

    public static KnowledgeBaseItemResponse unpublishArticle(String id) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .post(UNPUBLISH)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseItemResponse.class);
    }

    public static KnowledgeBaseItemResponse archiveArticle(String id) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .post(ARCHIVE)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseItemResponse.class);
    }

    /** Unchecked, for teardown. */
    public static Response archiveArticleRaw(String id) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .post(ARCHIVE);
    }

    /** Restores into {@code parentId} (root when null) as PUBLISHED. */
    public static KnowledgeBaseItemResponse unarchiveArticle(String id, String parentId) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(UnarchiveArticleRequest.builder().parentId(parentId).build())
                .post(UNARCHIVE)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseItemResponse.class);
    }

    public static ExternalErrorResponse attemptUnarchiveArticle(String id, String parentId, int expectedStatus) {
        return given(getExternalApiSpec())
                .pathParam("id", id)
                .body(UnarchiveArticleRequest.builder().parentId(parentId).build())
                .post(UNARCHIVE)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    // --- tags --------------------------------------------------------------------------------

    /** Only tags in use: with {@code folderId}, on articles in that subtree; else on active articles. */
    public static List<KnowledgeBaseTagResponse> getTags(Map<String, Object> queryParams) {
        return given(getExternalApiSpec())
                .queryParams(queryParams)
                .get(TAGS)
                .then().statusCode(200)
                .extract().jsonPath().getList(".", KnowledgeBaseTagResponse.class);
    }

    // --- attachments -------------------------------------------------------------------------

    /** Registers the attachment; the bytes then go to the returned signed URL. */
    public static KnowledgeBaseAttachmentUploadResponse createAttachment(String articleId,
                                                                         CreateKnowledgeBaseAttachmentRequest request) {
        return given(getExternalApiSpec())
                .pathParam("id", articleId)
                .body(request)
                .post(ARTICLE_ATTACHMENTS)
                .then().statusCode(201)
                .extract().as(KnowledgeBaseAttachmentUploadResponse.class);
    }

    public static String getAttachmentDownloadUrl(String attachmentId) {
        return given(getExternalApiSpec())
                .pathParam("attachmentId", attachmentId)
                .get(DOWNLOAD_URL)
                .then().statusCode(200)
                .extract().as(KnowledgeBaseAttachmentDownloadResponse.class).getDownloadUrl();
    }

    public static ExternalErrorResponse attemptGetAttachmentDownloadUrl(String attachmentId, int expectedStatus) {
        return given(getExternalApiSpec())
                .pathParam("attachmentId", attachmentId)
                .get(DOWNLOAD_URL)
                .then().statusCode(expectedStatus)
                .extract().as(ExternalErrorResponse.class);
    }

    /** 204 No Content; removes the stored file and the metadata. */
    public static void deleteAttachment(String attachmentId) {
        deleteAttachmentRaw(attachmentId).then().statusCode(204);
    }

    /** Unchecked, for teardown. */
    public static Response deleteAttachmentRaw(String attachmentId) {
        return given(getExternalApiSpec())
                .pathParam("attachmentId", attachmentId)
                .delete(ATTACHMENT_BY_ID);
    }
}
