package com.openframe.test.data.generator.external;

import com.openframe.test.data.dto.external.knowledgebase.CreateArticleRequest;
import com.openframe.test.data.dto.external.knowledgebase.CreateFolderRequest;
import com.openframe.test.data.dto.external.knowledgebase.CreateKnowledgeBaseAttachmentRequest;
import com.openframe.test.data.dto.external.knowledgebase.UpdateArticleRequest;

import java.nio.file.Path;

import static com.openframe.test.data.generator.external.ExternalTestData.MARKER;
import static com.openframe.test.data.generator.external.ExternalTestData.faker;
import static com.openframe.test.data.generator.external.ExternalTestData.uniqueName;

// Knowledge base payloads for the External API.
public class ExternalKnowledgeBaseGenerator {

    // Declared on create; the round trip PUTs the bytes with the same type, read back from the request.
    private static final String ATTACHMENT_CONTENT_TYPE = "text/plain";

    public static CreateFolderRequest createFolderRequest(String parentId) {
        return CreateFolderRequest.builder()
                .name(uniqueName("KB Folder"))
                .parentId(parentId)
                .build();
    }

    public static String folderName() {
        return uniqueName("Renamed KB Folder");
    }

    public static CreateArticleRequest createArticleRequest(String parentId) {
        return CreateArticleRequest.builder()
                .name(uniqueName("KB Article"))
                .parentId(parentId)
                .content("# " + faker().lorem().sentence() + "\n\n" + faker().lorem().paragraph())
                .summary(faker().lorem().sentence())
                .build();
    }

    public static UpdateArticleRequest updateArticleRequest() {
        return UpdateArticleRequest.builder()
                .name(uniqueName("Updated KB Article"))
                .content("# " + faker().lorem().sentence() + "\n\n" + faker().lorem().paragraph())
                .summary(faker().lorem().sentence())
                .build();
    }

    // A marked tag key; the External API cannot create tags, so the suite creates this one over GraphQL.
    public static String tagKey() {
        return uniqueName("kb-tag").replace(' ', '-');
    }

    // Declares file for upload; the stored file name carries the marker, not the temp-file name.
    public static CreateKnowledgeBaseAttachmentRequest attachmentRequest(Path file) {
        return CreateKnowledgeBaseAttachmentRequest.builder()
                .fileName(MARKER + "-" + file.getFileName())
                .contentType(ATTACHMENT_CONTENT_TYPE)
                .fileSize(file.toFile().length())
                .build();
    }
}
