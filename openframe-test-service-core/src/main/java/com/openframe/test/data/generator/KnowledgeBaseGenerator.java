package com.openframe.test.data.generator;

import com.openframe.test.data.dto.knowledgebase.*;
import net.datafaker.Faker;

import java.util.List;

public class KnowledgeBaseGenerator {

    private static final Faker faker = new Faker();

    public static String folderName() {
        return "QA KB Test Folder ".concat(faker.lorem().characters(10));
    }

    public static KnowledgeBaseFilterInput rootFoldersFilter() {
        return KnowledgeBaseFilterInput.builder()
                .type(KnowledgeBaseItemType.FOLDER)
                .build();
    }

    public static CreateArticleInput draftArticle(String parentFolderId, List<String> tagIds) {
        String name = "Test Article " + faker.lorem().sentence(3);
        return CreateArticleInput.builder()
                .name(name)
                .parentId(parentFolderId)
                .content(faker.lorem().paragraph())
                .summary(faker.lorem().sentence())
                .status(KnowledgeBaseArticleStatus.DRAFT)
                .tagIds(tagIds)
                .build();
    }

    public static String randomFolderName() {
        return "Test Folder " + faker.lorem().sentence(3);
    }

    public static UpdateArticleInput updateArticleRequest(KnowledgeBaseItem article) {
        return UpdateArticleInput.builder()
                .id(article.getId())
                .name(article.getName() + " (edited)")
                .parentId(article.getParentId())
                .content("Updated content " + article.getId())
                .summary("Updated summary " + article.getId())
                .build();
    }

    public static DeleteFolderInput deleteFolderArchivingChildren(String folderId) {
        return DeleteFolderInput.builder()
                .id(folderId)
                .childrenAction(FolderChildrenAction.ARCHIVE)
                .build();
    }
}
