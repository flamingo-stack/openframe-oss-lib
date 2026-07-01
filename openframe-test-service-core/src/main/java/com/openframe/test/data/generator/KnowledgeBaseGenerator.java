package com.openframe.test.data.generator;

import com.openframe.test.data.dto.knowledgebase.*;
import com.openframe.test.util.FileUtils;
import net.datafaker.Faker;

import java.nio.file.Path;

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

    public static CreateArticleInput draftArticle(String parentFolderId) {
        String name = "Test Article " + faker.lorem().sentence(3);
        return CreateArticleInput.builder()
                .name(name)
                .parentId(parentFolderId)
                .content(faker.lorem().paragraph())
                .summary(faker.lorem().sentence())
                .status(KnowledgeBaseArticleStatus.DRAFT)
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

    public static Path attachmentFile() {
        return FileUtils.createRandomFile(faker.number().numberBetween(1, 4096));
    }

    public static CreateKnowledgeBaseAttachmentInput attachmentInput(String articleId, Path file) {
        return CreateKnowledgeBaseAttachmentInput.builder()
                .articleId(articleId)
                .fileName(file.getFileName().toString())
                .contentType("text/plain")
                .fileSize(file.toFile().length())
                .build();
    }

    public static DeleteFolderInput deleteFolderArchivingChildren(String folderId) {
        return DeleteFolderInput.builder()
                .id(folderId)
                .childrenAction(FolderChildrenAction.ARCHIVE)
                .build();
    }
}
