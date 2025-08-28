package com.openframe.documents.tool;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "tags")
public class Tag {
    @Id
    private String id;

    @Indexed(unique = true)
    private String name;

    private String description;
    private String color;  // Optional

    private String organizationId;  // scope tags to organizations
    private Instant createdAt;
    private String createdBy;
}
