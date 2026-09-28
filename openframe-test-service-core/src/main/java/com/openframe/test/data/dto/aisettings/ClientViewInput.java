package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Payload for {@code updateClientView}; the avatar is set through the image REST endpoints instead. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ClientViewInput {
    private String assistantName;
    private String applicationTheme;
    private String accentColor;
}
