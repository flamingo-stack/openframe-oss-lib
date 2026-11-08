package com.openframe.test.data.dto.notification;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * An in-app notification as exposed by the {@code notifications} GraphQL API (openframe-api-service-core
 * {@code notification.graphqls}). {@code id} is a Relay global id ({@code Notification:<id>}), which the
 * read/delete mutations require. {@code category} is one of DASHBOARD, CUSTOMERS, DEVICES, SCRIPTS,
 * MONITORING, SOFTWARE, LOGS, TICKETS, MINGO, GENERIC; {@code severity} INFO, SUCCESS, WARNING, DANGER.
 * {@code attributes} is the flat fact map snapshotted at emission (null on legacy rows).
 */
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
