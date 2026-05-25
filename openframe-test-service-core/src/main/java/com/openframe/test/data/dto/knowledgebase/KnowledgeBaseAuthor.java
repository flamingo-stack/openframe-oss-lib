package com.openframe.test.data.dto.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class KnowledgeBaseAuthor {
    private String id;
    private String firstName;
    private String lastName;
    private String email;
    private KnowledgeBaseImage image;
}
