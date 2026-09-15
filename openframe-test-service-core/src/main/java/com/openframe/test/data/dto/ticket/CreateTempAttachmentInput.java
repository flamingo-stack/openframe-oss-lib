package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.nio.file.Path;

/** Payload for {@code createTempAttachmentUploadUrl}: a file to stage before linking it to a ticket. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CreateTempAttachmentInput {
    private String fileName;
    private String contentType;
    private Long fileSize;

    public static CreateTempAttachmentInput forFile(Path file, String contentType) {
        return CreateTempAttachmentInput.builder()
                .fileName(file.getFileName().toString())
                .contentType(contentType)
                .fileSize(file.toFile().length())
                .build();
    }
}
