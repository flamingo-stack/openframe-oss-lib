package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The client assistant's look ({@code clientView}): the tenant-wide default when {@code organizationId}
 * is null, otherwise one organization's override. {@code applicationTheme} is DARK | LIGHT | SYSTEM.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClientView {
    private String id;
    private String organizationId;
    private String assistantName;
    private String applicationTheme;
    private String accentColor;
    private String createdAt;
    private String updatedAt;
}
