package com.openframe.test.data.generator;

import com.openframe.test.data.dto.knowledgebase.CreateArticleInput;
import com.openframe.test.data.dto.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.test.data.dto.knowledgebase.KnowledgeBaseFilterInput;
import com.openframe.test.data.dto.knowledgebase.KnowledgeBaseItemType;
import net.datafaker.Faker;

import java.util.List;

public class KnowledgeBaseGenerator {

    private static final Faker faker = new Faker();

    public static KnowledgeBaseFilterInput rootFoldersFilter() {
        return KnowledgeBaseFilterInput.builder()
                .type(KnowledgeBaseItemType.FOLDER)
                .build();
    }

    public static KnowledgeBaseFilterInput articlesInFolderFilter(String folderId) {
        return KnowledgeBaseFilterInput.builder()
                .parentId(folderId)
                .type(KnowledgeBaseItemType.ARTICLE)
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
}
