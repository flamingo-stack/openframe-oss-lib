package com.openframe.test.data.dto.script;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The creating user of a script (the {@code author: User} field), reduced to the
 * fields the scripts table selects.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptAuthor {
    private String id;
    private String firstName;
    private String lastName;
    private String email;
    private Image image;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Image {
        private String imageUrl;
        private String hash;
    }
}
