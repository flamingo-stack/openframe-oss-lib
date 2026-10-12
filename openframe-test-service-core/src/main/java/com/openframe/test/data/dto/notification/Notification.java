package com.openframe.test.data.dto.notification;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

// id is a Relay global id (Notification:<id>); attributes is the flat fact map snapshotted at emission (null on legacy rows).
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class Notification {
    private String id;
    private String severity;
    private String title;
    private String description;
    private String createdAt;
    private Boolean read;
    private String category;
    private String type;
    private Map<String, Object> attributes;
}

