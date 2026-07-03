package com.openframe.test.api.graphql;

public class KnowledgeBaseQueries {

    public static final String KNOWLEDGE_BASE_ITEM = """
            query($id: ID!) {
                knowledgeBaseItem(id: $id) {
                    id
                    type
                    name
                    parentId
                    status
                    summary
                    content
                    publishedAt
                    createdAt
                    updatedAt
                    author {
                        id
                        firstName
                        lastName
                        email
                    }
                    tags {
                        id
                        key
                        color
                    }
                    attachments {
                        id
                        fileName
                        fileSize
                        contentType
                        createdAt
                    }
                }
            }
            """;

    public static final String KNOWLEDGE_BASE_FOLDER_TREE = """
            query {
                knowledgeBaseFolderTree {
                    id
                    type
                    name
                    parentId
                    sortOrder
                }
            }
            """;

    public static final String KNOWLEDGE_BASE_ARTICLE_TREE = """
            query {
                knowledgeBaseArticleTree {
                    id
                    type
                    name
                    parentId
                    status
                    sortOrder
                }
            }
            """;

    public static final String KNOWLEDGE_BASE_TAGS = """
            query($folderId: ID) {
                knowledgeBaseTags(folderId: $folderId) {
                    id
                    key
                    color
                    description
                }
            }
            """;

    public static final String KNOWLEDGE_BASE_ITEMS = """
            query($filter: KnowledgeBaseFilterInput, $search: String, $first: Int!, $after: String) {
                knowledgeBaseItems(filter: $filter, search: $search, first: $first, after: $after) {
                    edges {
                        node {
                            id
                            type
                            name
                            parentId
                            status
                            summary
                            createdAt
                            updatedAt
                            tags {
                                id
                                key
                                color
                            }
                        }
                        cursor
                    }
                    pageInfo {
                        endCursor
                        hasNextPage
                    }
                    filteredCount
                }
            }
            """;

    public static final String CREATE_ARTICLE = """
            mutation($input: CreateArticleInput!) {
                createArticle(input: $input) {
                    id
                    type
                    name
                    parentId
                    summary
                    content
                    status
                    publishedAt
                    createdAt
                    updatedAt
                    author {
                        id
                        firstName
                        lastName
                        email
                        image {
                            imageUrl
                            hash
                        }
                    }
                    tags {
                        id
                        key
                        color
                    }
                }
            }
            """;

    public static final String PUBLISH_ARTICLE = """
            mutation($id: ID!) {
                publishArticle(id: $id) {
                    id
                    status
                    publishedAt
                    updatedAt
                }
            }
            """;

    public static final String UPDATE_ARTICLE = """
            mutation($input: UpdateArticleInput!) {
                updateArticle(input: $input) {
                    id
                    name
                    parentId
                    content
                    summary
                    updatedAt
                }
            }
            """;

    private static final String FOLDER_FIELDS = """
            id
            type
            name
            parentId
            createdAt
            updatedAt
            """;

    public static final String CREATE_FOLDER = """
            mutation($name: String!, $parentId: ID) {
                createFolder(name: $name, parentId: $parentId) {
                    %s
                }
            }
            """.formatted(FOLDER_FIELDS);

    public static final String RENAME_FOLDER = """
            mutation($id: ID!, $name: String!) {
                renameFolder(id: $id, name: $name) {
                    %s
                }
            }
            """.formatted(FOLDER_FIELDS);

    public static final String MOVE_TO_FOLDER = """
            mutation($id: ID!, $parentId: ID) {
                moveToFolder(id: $id, parentId: $parentId) {
                    %s
                }
            }
            """.formatted(FOLDER_FIELDS);

    public static final String DELETE_FOLDER = """
            mutation($input: DeleteFolderInput!) {
                deleteFolder(input: $input)
            }
            """;

    private static final String ARTICLE_LIFECYCLE_FIELDS = """
            id
            type
            name
            parentId
            status
            publishedAt
            updatedAt
            """;

    public static final String ARCHIVE_ARTICLE = """
            mutation($id: ID!) {
                archiveArticle(id: $id) {
                    %s
                }
            }
            """.formatted(ARTICLE_LIFECYCLE_FIELDS);

    public static final String UNARCHIVE_ARTICLE = """
            mutation($id: ID!, $parentId: ID) {
                unarchiveArticle(id: $id, parentId: $parentId) {
                    %s
                }
            }
            """.formatted(ARTICLE_LIFECYCLE_FIELDS);

    private static final String TAG_OP_FIELDS = """
            id
            tags {
                id
                key
                color
            }
            updatedAt
            """;

    public static final String ADD_TAG_TO_ITEM = """
            mutation($itemId: ID!, $tagId: ID!) {
                addTagToKnowledgeBaseItem(itemId: $itemId, tagId: $tagId) {
                    %s
                }
            }
            """.formatted(TAG_OP_FIELDS);

    public static final String CREATE_ATTACHMENT_UPLOAD_URL = """
            mutation($input: CreateKnowledgeBaseAttachmentInput!) {
                createKnowledgeBaseAttachmentUploadUrl(input: $input) {
                    attachment {
                        id
                        fileName
                        fileSize
                        contentType
                        createdAt
                    }
                    uploadUrl
                    userErrors {
                        field
                        message
                    }
                }
            }
            """;

    public static final String ATTACHMENT_DOWNLOAD_URL = """
            query($attachmentId: ID!) {
                knowledgeBaseAttachmentDownloadUrl(attachmentId: $attachmentId)
            }
            """;

    public static final String CREATE_TEMP_ATTACHMENT_UPLOAD_URL = """
            mutation($input: CreateKnowledgeBaseTempAttachmentInput!) {
                createKnowledgeBaseTempAttachmentUploadUrl(input: $input) {
                    tempAttachment {
                        id
                        fileName
                        contentType
                        fileSize
                        uploadUrl
                        createdAt
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
            """;

    public static final String LINK_TEMP_ATTACHMENTS_TO_ARTICLE = """
            mutation($input: LinkKnowledgeBaseTempAttachmentsInput!) {
                linkKnowledgeBaseTempAttachmentsToArticle(input: $input) {
                    id
                    fileName
                    fileSize
                    contentType
                    createdAt
                }
            }
            """;

    public static final String DELETE_ATTACHMENT = """
            mutation($input: MutationDeleteInput!) {
                deleteKnowledgeBaseAttachment(input: $input) {
                    deletedId
                    userErrors {
                        field
                        message
                    }
                }
            }
            """;

    public static final String DELETE_TEMP_ATTACHMENT = """
            mutation($input: MutationDeleteInput!) {
                deleteKnowledgeBaseTempAttachment(input: $input) {
                    deletedId
                    userErrors {
                        field
                        message
                    }
                }
            }
            """;

    public static final String ARCHIVED_ARTICLES = """
            query($search: String, $tagIds: [ID], $first: Int, $after: String) {
                archivedArticles(search: $search, tagIds: $tagIds, first: $first, after: $after) {
                    edges {
                        node {
                            id
                            type
                            name
                            parentId
                            status
                            summary
                            createdAt
                            updatedAt
                            tags {
                                id
                                key
                                color
                            }
                        }
                        cursor
                    }
                    pageInfo {
                        endCursor
                        hasNextPage
                    }
                    filteredCount
                }
            }
            """;
}
