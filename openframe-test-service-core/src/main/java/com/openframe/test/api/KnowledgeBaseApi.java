package com.openframe.test.api;

import com.openframe.test.data.dto.knowledgebase.CreateArticleInput;
import com.openframe.test.data.dto.knowledgebase.DeleteFolderInput;
import com.openframe.test.data.dto.knowledgebase.KnowledgeBaseFilterInput;
import com.openframe.test.data.dto.knowledgebase.KnowledgeBaseItem;
import com.openframe.test.data.dto.knowledgebase.KnowledgeBaseTag;
import com.openframe.test.data.dto.knowledgebase.UpdateArticleInput;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.test.api.graphql.KnowledgeBaseQueries.ADD_TAG_TO_ITEM;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.ARCHIVED_ARTICLES;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.ARCHIVE_ARTICLE;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.KNOWLEDGE_BASE_ARTICLE_TREE;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.KNOWLEDGE_BASE_FOLDER_TREE;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.KNOWLEDGE_BASE_ITEM;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.REMOVE_TAG_FROM_ITEM;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.CREATE_ARTICLE;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.CREATE_FOLDER;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.DELETE_FOLDER;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.KNOWLEDGE_BASE_ITEMS;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.KNOWLEDGE_BASE_TAGS;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.MOVE_TO_FOLDER;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.PUBLISH_ARTICLE;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.RENAME_FOLDER;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.UNARCHIVE_ARTICLE;
import static com.openframe.test.api.graphql.KnowledgeBaseQueries.UPDATE_ARTICLE;
import static com.openframe.test.config.EnvironmentConfig.GRAPHQL;
import static com.openframe.test.helpers.RequestSpecHelper.getAuthorizedSpec;
import static com.openframe.test.helpers.RequestSpecHelper.graphqlSuccess;
import static io.restassured.RestAssured.given;

public class KnowledgeBaseApi {

    public static KnowledgeBaseItem getKnowledgeBaseItem(String id) {
        Map<String, Object> body = Map.of(
                "query", KNOWLEDGE_BASE_ITEM,
                "variables", Map.of("id", id)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.knowledgeBaseItem", KnowledgeBaseItem.class);
    }

    public static List<KnowledgeBaseItem> getKnowledgeBaseFolderTree() {
        Map<String, Object> body = Map.of("query", KNOWLEDGE_BASE_FOLDER_TREE);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data.knowledgeBaseFolderTree", KnowledgeBaseItem.class);
    }

    public static List<KnowledgeBaseItem> getKnowledgeBaseArticleTree() {
        Map<String, Object> body = Map.of("query", KNOWLEDGE_BASE_ARTICLE_TREE);
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data.knowledgeBaseArticleTree", KnowledgeBaseItem.class);
    }

    public static List<KnowledgeBaseItem> getKnowledgeBaseItems(KnowledgeBaseFilterInput filter, String search, int first) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("filter", filter);
        variables.put("search", search);
        variables.put("first", first);

        Map<String, Object> body = new HashMap<>();
        body.put("query", KNOWLEDGE_BASE_ITEMS);
        body.put("variables", variables);

        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data.knowledgeBaseItems.edges.node", KnowledgeBaseItem.class);
    }

    public static int getKnowledgeBaseItemsFilteredCount(KnowledgeBaseFilterInput filter, String search, int first) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("filter", filter);
        variables.put("search", search);
        variables.put("first", first);

        Map<String, Object> body = new HashMap<>();
        body.put("query", KNOWLEDGE_BASE_ITEMS);
        body.put("variables", variables);

        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getInt("data.knowledgeBaseItems.filteredCount");
    }

    public static List<KnowledgeBaseTag> getKnowledgeBaseTags(String folderId) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("folderId", folderId);

        Map<String, Object> body = new HashMap<>();
        body.put("query", KNOWLEDGE_BASE_TAGS);
        body.put("variables", variables);

        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data.knowledgeBaseTags", KnowledgeBaseTag.class);
    }

    public static KnowledgeBaseItem createArticle(CreateArticleInput input) {
        Map<String, Object> body = Map.of(
                "query", CREATE_ARTICLE,
                "variables", Map.of("input", input)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.createArticle", KnowledgeBaseItem.class);
    }

    public static KnowledgeBaseItem publishArticle(String articleId) {
        Map<String, Object> body = Map.of(
                "query", PUBLISH_ARTICLE,
                "variables", Map.of("id", articleId)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.publishArticle", KnowledgeBaseItem.class);
    }

    public static KnowledgeBaseItem updateArticle(UpdateArticleInput input) {
        Map<String, Object> body = Map.of(
                "query", UPDATE_ARTICLE,
                "variables", Map.of("input", input)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.updateArticle", KnowledgeBaseItem.class);
    }

    public static KnowledgeBaseItem createFolder(String name, String parentId) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("name", name);
        variables.put("parentId", parentId);

        Map<String, Object> body = Map.of(
                "query", CREATE_FOLDER,
                "variables", variables
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.createFolder", KnowledgeBaseItem.class);
    }

    public static KnowledgeBaseItem renameFolder(String folderId, String name) {
        Map<String, Object> body = Map.of(
                "query", RENAME_FOLDER,
                "variables", Map.of("id", folderId, "name", name)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.renameFolder", KnowledgeBaseItem.class);
    }

    public static KnowledgeBaseItem moveToFolder(String itemId, String parentId) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("id", itemId);
        variables.put("parentId", parentId);

        Map<String, Object> body = Map.of(
                "query", MOVE_TO_FOLDER,
                "variables", variables
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.moveToFolder", KnowledgeBaseItem.class);
    }

    public static boolean deleteFolder(DeleteFolderInput input) {
        Map<String, Object> body = Map.of(
                "query", DELETE_FOLDER,
                "variables", Map.of("input", input)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getBoolean("data.deleteFolder");
    }

    public static KnowledgeBaseItem archiveArticle(String articleId) {
        Map<String, Object> body = Map.of(
                "query", ARCHIVE_ARTICLE,
                "variables", Map.of("id", articleId)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.archiveArticle", KnowledgeBaseItem.class);
    }

    public static KnowledgeBaseItem unarchiveArticle(String articleId, String parentId) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("id", articleId);
        variables.put("parentId", parentId);

        Map<String, Object> body = Map.of(
                "query", UNARCHIVE_ARTICLE,
                "variables", variables
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.unarchiveArticle", KnowledgeBaseItem.class);
    }

    public static List<KnowledgeBaseItem> getArchivedArticles(String search, List<String> tagIds, int first) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("search", search);
        variables.put("tagIds", tagIds);
        variables.put("first", first);

        Map<String, Object> body = Map.of(
                "query", ARCHIVED_ARTICLES,
                "variables", variables
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getList("data.archivedArticles.edges.node", KnowledgeBaseItem.class);
    }

    public static KnowledgeBaseItem addTagToItem(String itemId, String tagId) {
        Map<String, Object> body = Map.of(
                "query", ADD_TAG_TO_ITEM,
                "variables", Map.of("itemId", itemId, "tagId", tagId)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.addTagToKnowledgeBaseItem", KnowledgeBaseItem.class);
    }

    public static KnowledgeBaseItem removeTagFromItem(String itemId, String tagId) {
        Map<String, Object> body = Map.of(
                "query", REMOVE_TAG_FROM_ITEM,
                "variables", Map.of("itemId", itemId, "tagId", tagId)
        );
        return given(getAuthorizedSpec())
                .body(body).post(GRAPHQL)
                .then().spec(graphqlSuccess())
                .extract().jsonPath().getObject("data.removeTagFromKnowledgeBaseItem", KnowledgeBaseItem.class);
    }
}
